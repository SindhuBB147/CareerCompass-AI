#!/usr/bin/env python3
"""
Research pipeline for verified college images (see ADD VERIFIED IMAGES task).

Input:  a manifest of {collegeId, name, city, district, state, website, bannerImage}
        (dumped from src/database/seed.ts's COLLEGES array).
Output: data/college-images.json — consumed by CollegeService.importCollegeImages()
        via `POST /admin/colleges/import/images`, and college-images-audit.json —
        the full per-college research trail used to write the audit report.

Two independent, source-verified strategies per college, tried in order:

  1. Wikipedia/Wikimedia Commons match — high confidence. Requires BOTH a strong
     name-similarity match AND an explicit Karnataka/city/district mention in the
     article's own intro text before being trusted, specifically to guard against
     "Government Engineering College"-style name collisions across states/cities
     (see task's "Wrong College Protection" requirement). Marked 'verified'.

  2. Official website Open Graph image — the college's own on-file
     `contact.website` homepage's <meta property="og:image">. This proves the
     image is hosted by the college's own site, but a script can't visually
     confirm it's actually a campus photo (vs. a generic banner/ad), so these
     are always marked 'needs_review' for a human admin to promote to
     'verified' or reject, never auto-verified.

Colleges with neither are left with an empty `images` list (status: missing) —
per the task's explicit instruction, no image is fabricated or guessed.

Global duplicate detection: if the exact same image URL would end up assigned
to more than one distinct college (common when several constituent colleges
share one trust/parent-society homepage), only the first college (by
collegeId) keeps it; the rest fall back to 'missing' rather than showing an
identical photo under two different colleges' names.

Usage:
  python3 scripts/research-college-images.py <manifest.json> <out_images.json> <out_audit.json>
"""
import concurrent.futures
import difflib
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request

import requests
from PIL import Image

UA = 'Mozilla/5.0 (compatible; CareerCompassAI-ResearchBot/1.0; +mailto:mriranna21@gmail.com)'
WIKI_API = 'https://en.wikipedia.org/w/api.php'
MIN_DIM = 250
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 8
MAX_WORKERS = 20

STOPWORDS = {
    'college', 'colleges', 'of', 'and', 'the', 'a', 'an', 'for', 'institute', 'institution',
    'society', "society's", "s", 'engineering', 'technology', 'trust', 'education', 'educational',
}


def norm_tokens(s: str):
    s = re.sub(r"[^a-z0-9\s]", ' ', s.lower())
    return {t for t in s.split() if t and t not in STOPWORDS and len(t) > 1}


def name_similarity(a: str, b: str) -> float:
    ta, tb = norm_tokens(a), norm_tokens(b)
    seq = difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()
    # Token overlap is the authoritative signal once both sides have >=2
    # distinctive (non-stopword) tokens — it must NOT be maxed against the
    # whole-string character ratio, or two DIFFERENT colleges that both
    # happen to say "College of Engineering" (extremely common boilerplate
    # across hundreds of Indian college names) can score deceptively high on
    # shared phrasing alone. Confirmed in testing: "Mysore College Of
    # Engineering and Management" vs "University of Visvesvaraya College of
    # Engineering" — zero shared distinctive words, but ~0.56 on raw
    # character similarity, which would have wrongly matched them.
    # Below the 2-token floor (e.g. a name reduced to one surname), the
    # token signal is too thin to trust either way, so character similarity
    # is the only remaining signal.
    if len(ta) < 2 or len(tb) < 2:
        return seq
    return len(ta & tb) / max(len(ta), len(tb))


LOGO_FILENAME_RE = re.compile(r'logo|seal|crest|emblem|coat.?of.?arms|monogram|insignia|icon|symbol|wordmark|font|badge|\bbrand(ing)?\b', re.IGNORECASE)
TITLE_RE = re.compile(r'<title[^>]*>(.*?)</title>', re.IGNORECASE | re.DOTALL)


def is_probably_photo(url: str) -> bool:
    """PNG is the near-universal format for Wikipedia infobox
    logos/wordmarks (transparency), while genuine campus photographs are
    almost always JPEG — a stronger, format-based backstop for the cases
    LOGO_FILENAME_RE's keyword list doesn't catch (e.g. a wordmark file
    named just "Official_Font.png")."""
    path = url.split('?')[0].lower()
    return path.endswith('.jpg') or path.endswith('.jpeg')

# Karnataka cities Wikipedia often still refers to by their pre-2014 English
# name — without these, the geo-confirmation check below would wrongly
# reject a correct match just because the article says "Bangalore" and our
# seed data says "Bengaluru" (or vice versa).
CITY_ALIASES = {
    'bengaluru': ['bangalore'], 'bangalore': ['bengaluru'],
    'mysuru': ['mysore'], 'mysore': ['mysuru'],
    'mangaluru': ['mangalore'], 'mangalore': ['mangaluru'],
    'belagavi': ['belgaum'], 'belgaum': ['belagavi'],
    'kalaburagi': ['gulbarga'], 'gulbarga': ['kalaburagi'],
    'ballari': ['bellary'], 'bellary': ['ballari'],
    'tumakuru': ['tumkur'], 'tumkur': ['tumakuru'],
    'vijayapura': ['bijapur'], 'bijapur': ['vijayapura'],
    'shivamogga': ['shimoga'], 'shimoga': ['shivamogga'],
    'chikkaballapur': ['chikballapur', 'chikkaballapura'],
    'hubballi': ['hubli'], 'hubli': ['hubballi'],
}


def location_confirmed(extract: str, college: dict) -> bool:
    """City/district match only — NOT a bare 'Karnataka' mention, which is
    true of virtually every college here and so doesn't discriminate between
    two different Karnataka institutions (the actual failure mode this
    guards against: a same-shaped name matching a different city's college)."""
    for field in ('city', 'district'):
        val = (college.get(field) or '').lower().strip()
        if not val:
            continue
        candidates = [val] + CITY_ALIASES.get(val, [])
        # District values often carry a suffix like "Bengaluru Urban" — also
        # try just its first word.
        first_word = val.split(' ')[0]
        candidates += [first_word] + CITY_ALIASES.get(first_word, [])
        if any(c and c in extract for c in candidates):
            return True
    return False


def name_relates_to_filename(college_name: str, filename: str) -> bool:
    """Guards the Wikipedia secondary-image fallback: articles routinely
    embed images of unrelated nearby landmarks or history alongside the
    subject (a real case caught in testing: an unrelated city palace photo
    embedded in a college's article). Require the image's own filename to
    plausibly reference the college by a shared word/prefix."""
    base = re.sub(r'^File:', '', filename)
    base = re.sub(r'\.(jpe?g|png)$', '', base, flags=re.IGNORECASE)
    words = [w for w in re.split(r'[^a-z0-9]+', base.lower()) if w]
    tokens = [t for t in norm_tokens(college_name) if len(t) >= 3]
    return any(w.startswith(tok) or tok.startswith(w) for tok in tokens for w in words)


def session():
    s = requests.Session()
    s.headers.update({'User-Agent': UA})
    return s


def wiki_lookup(sess, college):
    """Return a verified image dict or None."""
    name = college['name']
    try:
        resp = sess.get(WIKI_API, params={
            'action': 'query', 'generator': 'search', 'gsrsearch': f'{name} Karnataka',
            'gsrlimit': 3, 'prop': 'pageimages|extracts|info', 'inprop': 'url',
            'piprop': 'thumbnail', 'pithumbsize': 1200, 'exintro': 1, 'explaintext': 1,
            'exchars': 800, 'format': 'json',
        }, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
        resp.raise_for_status()
        pages = (resp.json().get('query') or {}).get('pages') or {}
    except Exception as e:
        return None, f'wiki_error: {e}'

    best = None
    best_score = 0.0
    for page in pages.values():
        title = page.get('title', '')
        sim = name_similarity(name, title)
        if sim > best_score:
            best_score = sim
            best = page

    if not best or best_score < 0.55:
        return None, f'wiki_no_confident_match (best={best_score:.2f})'

    extract = (best.get('extract') or '').lower()
    if not location_confirmed(extract, college):
        return None, f'wiki_geo_unconfirmed (title={best.get("title")!r}, sim={best_score:.2f})'

    page_title = best.get('title', '')
    page_url = best.get('fullurl') or f"https://en.wikipedia.org/wiki/{urllib.parse.quote(page_title)}"
    thumb = (best.get('thumbnail') or {}).get('source')

    # The API's `pageimages` prop returns whatever image sits first in the
    # infobox, which for many Indian college articles is the institution's
    # LOGO, not a campus photo — using it would violate the task's "prefer
    # campus/building" requirement for the primary image. Reject it by
    # filename and fall back to scanning the page's other images for a real
    # photo instead of trusting it blindly.
    if thumb and not LOGO_FILENAME_RE.search(thumb) and is_probably_photo(thumb):
        return {
            # Not deriving a smaller thumbnailUrl by string-substituting the
            # width segment — confirmed in testing that Wikimedia's thumbnail
            # service 400s on arbitrary widths that weren't the one actually
            # requested via the API (e.g. swapping a 1280px thumb URL for a
            # "480px" one breaks it), which silently tripped the frontend's
            # broken-image fallback. `url` itself is the exact URL the API
            # handed back, so it's the only one guaranteed to resolve.
            'category': 'Campus', 'url': thumb, 'thumbnailUrl': None,
            'title': 'Campus', 'altText': f"{college['name']} campus in {college.get('city') or college.get('state')}",
            'sourceUrl': page_url, 'sourceName': 'Wikipedia', 'verificationStatus': 'verified', 'isPrimary': True,
        }, f'wiki_matched (title={page_title!r}, sim={best_score:.2f})'

    photo = wiki_find_non_logo_image(sess, page_title, name)
    if photo:
        return {
            'category': 'Campus', 'url': photo, 'thumbnailUrl': None,
            'title': 'Campus', 'altText': f"{college['name']} campus in {college.get('city') or college.get('state')}",
            'sourceUrl': page_url, 'sourceName': 'Wikipedia', 'verificationStatus': 'verified', 'isPrimary': True,
        }, f'wiki_matched_secondary_image (title={page_title!r}, sim={best_score:.2f})'

    return None, f'wiki_logo_only_no_photo (title={page_title!r}, sim={best_score:.2f})'


def wiki_find_non_logo_image(sess, page_title, college_name):
    """Scan a Wikipedia article's embedded images for a real (non-logo/icon)
    photo that plausibly depicts the college itself (not just anything else
    referenced in the article), returning a usable image URL, or None."""
    try:
        resp = sess.get(WIKI_API, params={
            'action': 'query', 'titles': page_title, 'prop': 'images', 'imlimit': 20, 'format': 'json',
        }, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
        resp.raise_for_status()
        pages = (resp.json().get('query') or {}).get('pages') or {}
        image_titles = [im['title'] for p in pages.values() for im in (p.get('images') or [])]
    except Exception:
        return None

    candidates = [
        t for t in image_titles
        if re.search(r'\.jpe?g$', t, re.IGNORECASE) and not LOGO_FILENAME_RE.search(t)
        and not re.search(r'flag|map|locator|commons.?logo|wiki', t, re.IGNORECASE)
        and name_relates_to_filename(college_name, t)
    ]
    if not candidates:
        return None

    try:
        resp = sess.get(WIKI_API, params={
            'action': 'query', 'titles': '|'.join(candidates[:5]), 'prop': 'imageinfo',
            'iiprop': 'url|size', 'iiurlwidth': 1200, 'format': 'json',
        }, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
        resp.raise_for_status()
        pages = (resp.json().get('query') or {}).get('pages') or {}
        for p in pages.values():
            infos = p.get('imageinfo') or []
            if not infos:
                continue
            info = infos[0]
            w, h = info.get('width', 0), info.get('height', 0)
            if w >= MIN_DIM and h >= MIN_DIM:
                return info.get('thumburl') or info.get('url')
    except Exception:
        return None
    return None


META_IMG_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
META_IMG_RE_REV = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\']',
    re.IGNORECASE,
)


def validate_image_url(sess, img_url):
    """GET the candidate, confirm it's really an image of adequate size.
    Returns (width, height) or raises."""
    if STOCK_PHOTO_HOST_RE.search(img_url):
        raise ValueError('stock_photo_host_rejected')
    img_resp = sess.get(img_url, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT), stream=True)
    img_resp.raise_for_status()
    ctype = img_resp.headers.get('Content-Type', '')
    if not ctype.startswith('image/'):
        raise ValueError(f'not_an_image (content-type={ctype!r})')
    content = img_resp.raw.read(3_000_000, decode_content=True)
    im = Image.open(io.BytesIO(content))
    w, h = im.size
    if w < MIN_DIM or h < MIN_DIM:
        raise ValueError(f'too_small ({w}x{h})')
    return w, h


IMG_TAG_RE = re.compile(r'<img\b([^>]*)>', re.IGNORECASE)
IMG_ATTR_RE = re.compile(r'(\w[\w-]*)\s*=\s*["\']([^"\']*)["\']', re.IGNORECASE)
BANNER_HINT_RE = re.compile(r'banner|hero|slide|carousel|slider|cover', re.IGNORECASE)
CAMPUS_HINT_RE = re.compile(r'campus|college|building|main[-_]?block|university', re.IGNORECASE)
SKIP_IMG_RE = re.compile(
    r'icon|sprite|pixel|blank|spacer|favicon|logo|sponsor|payment|social|facebook|twitter|instagram'
    r'|linkedin|youtube|whatsapp|badge|award|certificate|avatar|placeholder|loading|arrow|button'
    r'|admission|placement|notice|announcement|principal|director|chairman|trustee|shape|pattern|decor'
    # Descriptive-adjective stock-photo naming convention (e.g. a filename
    # confirmed in testing: "handsome-indian-young-boy-wearing-white-shirt-
    # red-tie-1-scaled.jpg" — unmistakably a generic stock portrait, not a
    # campus photo) plus achievement/rank-holder congratulatory banners,
    # which are graphics of people, not the institution.
    r'|handsome|beautiful|attractive|smiling|portrait|businessman|businesswoman|headshot'
    r'|rank-?holder|topper|achiever|testimonial',
    re.IGNORECASE,
)
# Stock-photo libraries — never authentic to the specific college, so a hit
# here is rejected outright rather than merely down-ranked, for both the
# og:image path and the homepage-scan fallback.
STOCK_PHOTO_HOST_RE = re.compile(
    r'unsplash\.com|pexels\.com|pixabay\.com|shutterstock\.com|istockphoto\.com|gettyimages\.|freepik\.com|stock\.adobe\.com',
    re.IGNORECASE,
)


def find_banner_image_candidates(html: str, base_url: str):
    """Rank <img> tags in raw homepage HTML by how likely they are to be a
    genuine hero/campus photo, without executing JS — good enough for the
    mostly server-rendered college sites this targets. Never trusted as
    'verified' on its own; downstream validation + human review still gate
    it, same as the Open Graph path."""
    scored = []
    for order, tag_match in enumerate(IMG_TAG_RE.finditer(html)):
        attrs = dict((k.lower(), v) for k, v in IMG_ATTR_RE.findall(tag_match.group(1)))
        src = attrs.get('src') or attrs.get('data-src') or attrs.get('data-lazy-src')
        if not src or src.startswith('data:'):
            continue
        haystack = ' '.join([src, attrs.get('class', ''), attrs.get('id', ''), attrs.get('alt', '')])
        if SKIP_IMG_RE.search(haystack):
            continue
        path = src.split('?')[0].lower()
        if path.endswith('.svg') or path.endswith('.gif'):
            continue
        try:
            w_attr = int(re.sub(r'\D', '', attrs.get('width', '')) or 0)
            h_attr = int(re.sub(r'\D', '', attrs.get('height', '')) or 0)
        except ValueError:
            w_attr = h_attr = 0
        if (w_attr and w_attr < 200) or (h_attr and h_attr < 150):
            continue

        score = 0
        if BANNER_HINT_RE.search(haystack):
            score += 3
        if CAMPUS_HINT_RE.search(haystack):
            score += 2
        if w_attr >= 600:
            score += 1
        score -= order * 0.01  # mild preference for images earlier in the page (header/hero)
        scored.append((score, urllib.parse.urljoin(base_url, src)))

    scored.sort(key=lambda t: t[0], reverse=True)
    seen, ordered_urls = set(), []
    for _, url in scored:
        if url not in seen:
            seen.add(url)
            ordered_urls.append(url)
    return ordered_urls[:5]


def website_og_image(sess, college):
    website = college.get('website')
    if not website:
        return None, 'no_website'
    try:
        resp = sess.get(website, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT), allow_redirects=True)
        resp.raise_for_status()
        html = resp.text[:400_000]
    except Exception as e:
        return None, f'website_fetch_error: {e}'

    # Guards against bad `contact.website` data pointing at an unrelated
    # institution (seen in practice — a college's website field pointing at
    # a well-known but entirely different institution's domain). Require the
    # fetched page's own <title> to plausibly be about this college before
    # trusting anything scraped from it.
    title_match = TITLE_RE.search(html)
    page_title = re.sub(r'\s+', ' ', title_match.group(1)).strip() if title_match else ''
    if page_title and name_similarity(college['name'], page_title) < 0.2:
        return None, f'website_title_mismatch (page_title={page_title!r})'

    m = META_IMG_RE.search(html) or META_IMG_RE_REV.search(html)
    if m and (LOGO_FILENAME_RE.search(m.group(1)) or SKIP_IMG_RE.search(m.group(1))):
        m = None  # og:image is a logo/wordmark or otherwise disqualified (stock portrait, promo banner, ...) — skip to the banner-scan fallback
    if m:
        img_url = urllib.parse.urljoin(resp.url, m.group(1).strip())
        try:
            w, h = validate_image_url(sess, img_url)
            return {
                'category': 'Campus', 'url': img_url, 'thumbnailUrl': None,
                'title': 'Campus', 'altText': f"{college['name']} campus in {college.get('city') or college.get('state')}",
                'sourceUrl': resp.url, 'sourceName': 'Official Website (Open Graph)', 'verificationStatus': 'needs_review',
                'isPrimary': True,
            }, f'website_og_image ({w}x{h})'
        except Exception as e:
            og_fail_reason = f'og_image_invalid: {e}'
    else:
        og_fail_reason = 'no_og_image'

    # No usable og:image — fall back to scanning the raw page for a
    # plausible hero/banner photo. Still 'needs_review' only.
    for candidate_url in find_banner_image_candidates(html, resp.url):
        try:
            w, h = validate_image_url(sess, candidate_url)
            return {
                'category': 'Campus', 'url': candidate_url, 'thumbnailUrl': None,
                'title': 'Campus', 'altText': f"{college['name']} campus in {college.get('city') or college.get('state')}",
                'sourceUrl': resp.url, 'sourceName': 'Official Website (homepage image)', 'verificationStatus': 'needs_review',
                'isPrimary': True,
            }, f'website_banner_image ({w}x{h})'
        except Exception:
            continue

    return None, f'{og_fail_reason}; no_banner_candidate'


def research_one(college):
    try:
        return research_one_inner(college)
    except Exception as e:
        return college['collegeId'], {
            'collegeId': college['collegeId'], 'name': college['name'], 'status': 'missing',
            'reason': f'unexpected_error: {type(e).__name__}: {e}', 'image': None,
        }


def research_one_inner(college):
    sess = session()
    cid = college['collegeId']

    existing_banner = college.get('bannerImage')
    # A prior pass seeded 10 colleges' bannerImage from Wikipedia directly,
    # without this script's logo/wordmark filtering — several turned out to
    # be logo files (e.g. "..._Logo.png"), which fails the same "campus
    # photo, not a logo" bar this script enforces everywhere else. Only
    # short-circuit on it when it actually looks like a photo; otherwise
    # fall through to full research exactly as if no banner existed.
    if existing_banner and not LOGO_FILENAME_RE.search(existing_banner) and is_probably_photo(existing_banner):
        return cid, {
            'collegeId': cid, 'name': college['name'], 'status': 'verified_existing',
            'reason': 'reused pre-existing verified bannerImage from seed data',
            'image': {
                'category': 'Campus', 'url': existing_banner, 'thumbnailUrl': None, 'title': 'Campus',
                'altText': f"{college['name']} campus in {college.get('city') or college.get('state')}",
                'sourceUrl': None, 'sourceName': 'Existing verified seed data', 'verificationStatus': 'verified',
                'isPrimary': True,
            },
        }

    img, reason = wiki_lookup(sess, college)
    if img:
        return cid, {'collegeId': cid, 'name': college['name'], 'status': 'verified', 'reason': reason, 'image': img}

    wiki_reason = reason
    img, reason = website_og_image(sess, college)
    if img:
        return cid, {'collegeId': cid, 'name': college['name'], 'status': 'needs_review', 'reason': f'{wiki_reason}; {reason}', 'image': img}

    return cid, {'collegeId': cid, 'name': college['name'], 'status': 'missing', 'reason': f'{wiki_reason}; {reason}', 'image': None}


def main():
    manifest_path, out_images_path, out_audit_path = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(manifest_path) as f:
        manifest = json.load(f)

    results = {}
    done = 0
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = [ex.submit(research_one, c) for c in manifest]
        for fut in concurrent.futures.as_completed(futures):
            cid, record = fut.result()
            results[cid] = record
            done += 1
            if done % 25 == 0:
                print(f'  {done}/{len(manifest)} processed ({time.time() - t0:.0f}s elapsed)', file=sys.stderr)

    # Global duplicate-image detection — keep the first collegeId (sorted),
    # blank out the rest so no two colleges show an identical photo. Dedupes
    # on the URL's path only (query string stripped): the same Wikimedia
    # file can legitimately reach this script via two different API calls
    # that each append a different ?utm_campaign= tracking suffix, which
    # would otherwise defeat exact-string matching for what is, on disk,
    # the exact same image.
    url_to_ids = {}
    for cid, r in results.items():
        if r['image']:
            # Also normalize away Wikipedia's width-prefixed thumb segment
            # (".../1280px-File.jpg" vs ".../250px-File.jpg") so the same
            # underlying file at two different requested resolutions still
            # dedupes as one image.
            dedupe_key = re.sub(r'/\d+px-', '/px-', r['image']['url'].split('?')[0])
            url_to_ids.setdefault(dedupe_key, []).append(cid)
    for url, ids in url_to_ids.items():
        if len(ids) > 1:
            ids_sorted = sorted(ids)
            keep = ids_sorted[0]
            for dupe_id in ids_sorted[1:]:
                results[dupe_id]['status'] = 'missing'
                results[dupe_id]['reason'] += f'; duplicate_image_shared_with={keep} (excluded)'
                results[dupe_id]['image'] = None

    # data/college-images.json — importCollegeImages() input
    images_out = []
    for c in manifest:
        cid = c['collegeId']
        r = results.get(cid)
        images = [r['image']] if r and r['image'] else []
        images_out.append({'collegeId': cid, 'images': images})
    with open(out_images_path, 'w') as f:
        json.dump(images_out, f, indent=2)

    with open(out_audit_path, 'w') as f:
        json.dump(list(results.values()), f, indent=2)

    verified = sum(1 for r in results.values() if r['status'] in ('verified', 'verified_existing'))
    needs_review = sum(1 for r in results.values() if r['status'] == 'needs_review')
    missing = sum(1 for r in results.values() if r['status'] == 'missing')
    print(f'\nDone in {time.time() - t0:.0f}s. Verified={verified} NeedsReview={needs_review} Missing={missing} Total={len(results)}')


if __name__ == '__main__':
    main()
