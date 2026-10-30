// apps/api/scripts/import_official_kcet.js
// Production import script for Official KEA KCET Engineering Cutoffs
// Ingests verified PDFs from apps/api/data/kcet-sources into MongoDB cutoffs collection.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { PDFParse } = require('pdf-parse');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/career-compass-dev';
const SOURCE_DIR = path.resolve(__dirname, '../data/kcet-sources');

const KEA_CATEGORIES = [
  '1G', '1K', '1R',
  '2AG', '2AK', '2AR',
  '2BG', '2BK', '2BR',
  '3AG', '3AK', '3AR',
  '3BG', '3BK', '3BR',
  'GM', 'GMK', 'GMR',
  'SCG', 'SCK', 'SCR',
  'STG', 'STK', 'STR'
];

// Mapping of KEA vertical general categories to application standard category codes
const CATEGORY_ALIASES = {
  'GM': ['GM', 'General'],
  '1G': ['Cat-1', '1G', 'Category-1'],
  '2AG': ['2A', '2AG'],
  '2BG': ['2B', '2BG'],
  '3AG': ['3A', '3AG'],
  '3BG': ['3B', '3BG'],
  'SCG': ['SC', 'SCG'],
  'STG': ['ST', 'STG']
};

const PDF_SOURCES = [
  {
    fileName: 'ENGG_CUTOFF_2023_GENenglish.pdf',
    sourceUrl: 'https://cetonline.karnataka.gov.in/keawebentry456/ENGG_CUTOFF_2023_GENenglish.pdf',
    year: 2023,
    round: 1,
    status: 'official'
  },
  {
    fileName: 'ENGG_CUTOFF_2023_R2english.pdf',
    sourceUrl: 'https://cetonline.karnataka.gov.in/keawebentry456/ENGG_CUTOFF_2023_R2english.pdf',
    year: 2023,
    round: 2,
    status: 'official'
  },
  {
    fileName: 'ENR2_CUTGENenglish.pdf',
    sourceUrl: 'https://cetonline.karnataka.gov.in/keawebentry456/ENR2_CUTGENenglish.pdf',
    year: 2023,
    round: 3,
    status: 'official'
  }
];

// Mapping of standard 2-letter KEA course codes to full branch names and keywords
const KEA_COURSE_MAP = {
  'CS': { name: 'Computer Science and Engineering', keywords: ['computer science', 'cse'] },
  'IS': { name: 'Information Science and Engineering', keywords: ['information science', 'ise'] },
  'IE': { name: 'Information Science and Engineering', keywords: ['information science', 'ise'] },
  'AI': { name: 'Artificial Intelligence and Machine Learning', keywords: ['artificial intelligence', 'aiml', 'ai & ml'] },
  'AD': { name: 'Artificial Intelligence and Data Science', keywords: ['artificial intelligence and data science', 'ai & ds', 'aids'] },
  'DS': { name: 'Computer Science and Engineering (Data Science)', keywords: ['data science'] },
  'CY': { name: 'Computer Science and Engineering (Cyber Security)', keywords: ['cyber security', 'cyber'] },
  'EC': { name: 'Electronics and Communication Engineering', keywords: ['electronics & communication', 'electronics and communication', 'ece'] },
  'EE': { name: 'Electrical and Electronics Engineering', keywords: ['electrical & electronics', 'electrical and electronics', 'eee'] },
  'ME': { name: 'Mechanical Engineering', keywords: ['mechanical'] },
  'CE': { name: 'Civil Engineering', keywords: ['civil'] },
  'BT': { name: 'Biotechnology', keywords: ['biotechnology', 'bio-technology'] },
  'CH': { name: 'Chemical Engineering', keywords: ['chemical'] },
  'AE': { name: 'Aerospace Engineering', keywords: ['aerospace', 'aeronautical'] },
  'AU': { name: 'Automobile Engineering', keywords: ['automobile'] },
  'EI': { name: 'Electronics and Instrumentation Engineering', keywords: ['instrumentation'] },
  'ET': { name: 'Electronics and Telecommunication Engineering', keywords: ['telecommunication'] },
  'IM': { name: 'Industrial Engineering and Management', keywords: ['industrial engineering', 'industrial & production'] },
  'IP': { name: 'Industrial and Production Engineering', keywords: ['industrial & production', 'production engineering'] },
  'RA': { name: 'Robotics and Automation', keywords: ['robotics', 'automation'] },
  'RO': { name: 'Robotics Engineering', keywords: ['robotics'] },
  'MD': { name: 'Medical Electronics Engineering', keywords: ['medical electronics'] },
  'BM': { name: 'Biomedical Engineering', keywords: ['biomedical'] },
  'MR': { name: 'Marine Engineering', keywords: ['marine'] },
  'MN': { name: 'Mining Engineering', keywords: ['mining'] },
  'ST': { name: 'Silk Technology', keywords: ['silk tech'] },
  'TX': { name: 'Textile Technology', keywords: ['textile'] }
};

function normalizeString(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function run() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected successfully.');

  const db = mongoose.connection.db;
  const collegesColl = db.collection('colleges');
  const cutoffsColl = db.collection('cutoffs');

  // Load all colleges
  const allColleges = await collegesColl.find({}).toArray();
  console.log(`Loaded ${allColleges.length} colleges from database.`);

  const collegeByCode = new Map();
  const collegeByName = new Map();
  allColleges.forEach(c => {
    if (c.collegeId) collegeByCode.set(c.collegeId.toUpperCase().trim(), c);
    const normName = normalizeString(c.name);
    if (normName) collegeByName.set(normName, c);
  });

  const manifest = [];
  let grandTotalCutoffs = 0;

  for (const src of PDF_SOURCES) {
    const filePath = path.join(SOURCE_DIR, src.fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}, skipping.`);
      continue;
    }

    console.log(`\n======================================================`);
    console.log(`Processing: ${src.fileName} (Year: ${src.year}, Round: ${src.round})`);
    console.log(`======================================================`);

    const t0 = Date.now();
    const dataBuf = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuf });
    const doc = await parser.load();
    const numPages = doc.numPages;

    const bulkOps = [];
    let fileRowsParsed = 0;
    let fileCutoffsInserted = 0;
    const collegesInPdf = new Set();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items.filter(it => it.str && it.str.trim());

      const byY = {};
      items.forEach(it => {
        const y = Math.round(it.transform[5]);
        const key = Object.keys(byY).find(k => Math.abs(k - y) <= 2) || y;
        if (!byY[key]) byY[key] = [];
        byY[key].push(it);
      });

      const sortedY = Object.keys(byY).map(Number).sort((a, b) => b - a);

      // Find all college headings on this page
      const collegeHeadings = [];
      for (const y of sortedY) {
        const lineStr = byY[y].sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str.trim()).join(' ');
        const match = lineStr.match(/(?:^|\s)(E\d{3})\s+([A-Za-z0-9\.,\s\(\)\-\&]+)/);
        if (match && byY[y][0].transform[4] < 200) {
          collegeHeadings.push({ y, code: match[1], name: match[2].trim() });
        }
      }

      let currentCollegeCode = null;
      let currentCollegeName = null;

      for (const y of sortedY) {
        const heading = collegeHeadings.find(h => Math.abs(h.y - y) <= 2);
        if (heading) {
          currentCollegeCode = heading.code;
          currentCollegeName = heading.name;
          collegesInPdf.add(currentCollegeCode);
          continue;
        }

        if (!currentCollegeCode) {
          if (collegeHeadings.length > 0 && y > collegeHeadings[0].y) continue;
        }

        const lineItems = byY[y].sort((a, b) => a.transform[4] - b.transform[4]);
        const leftItems = lineItems.filter(i => i.transform[4] < 180);
        const rankItems = lineItems.filter(i => i.transform[4] >= 180);

        const courseRaw = leftItems.map(i => i.str.trim()).join(' ');
        if (!courseRaw || rankItems.length === 0) continue;

        const rawTokens = [];
        rankItems.forEach(i => {
          i.str.trim().split(/\s+/).forEach(t => {
            if (t) rawTokens.push(t);
          });
        });

        const tokens = [];
        rawTokens.forEach(tok => {
          if (tok.length > 6 && /^\d+$/.test(tok)) {
            for (let c = 0; c < tok.length; c += 6) {
              tokens.push(tok.slice(c, c + 6));
            }
          } else {
            tokens.push(tok);
          }
        });

        if (tokens.length < 20 || tokens.length > 26) continue;

        fileRowsParsed++;

        // Find college in DB
        const college = collegeByCode.get(currentCollegeCode) || collegeByName.get(normalizeString(currentCollegeName));
        if (!college) {
          continue;
        }

        // Identify course code & name from courseRaw (e.g. "CS Computers", "EC Electronics")
        const codeMatch = courseRaw.match(/^([A-Za-z]{2})\b/);
        const twoLetterCode = codeMatch ? codeMatch[1].toUpperCase() : courseRaw.slice(0, 2).toUpperCase();
        const courseDef = KEA_COURSE_MAP[twoLetterCode];
        const canonicalCourseName = courseDef ? courseDef.name : courseRaw;
        const keywords = courseDef ? courseDef.keywords : [courseRaw.toLowerCase()];

        // Match against college's existing courses
        const existingCourses = college.courses || [];
        const matchedCourses = [];

        // 1. Direct courseId matches or keyword matches in existing courses
        for (const cr of existingCourses) {
          const crNameLower = (cr.name || '').toLowerCase();
          const crIdLower = (cr.courseId || '').toLowerCase();
          const isMatch = keywords.some(kw => crNameLower.includes(kw) || crIdLower.includes(kw));
          if (isMatch) {
            matchedCourses.push(cr);
          }
        }

        // 2. If no matched course in college, create a canonical course identifier
        const defaultCourseId = `${college.collegeId || currentCollegeCode}-${twoLetterCode}`;
        if (matchedCourses.length === 0) {
          matchedCourses.push({
            courseId: defaultCourseId,
            name: canonicalCourseName
          });
        }

        // Extract ranks for all categories
        for (let catIdx = 0; catIdx < Math.min(tokens.length, KEA_CATEGORIES.length); catIdx++) {
          const rankStr = tokens[catIdx];
          if (!rankStr || rankStr === '--' || !/^\d+$/.test(rankStr)) continue;
          const closingRank = parseInt(rankStr, 10);
          const rawCategory = KEA_CATEGORIES[catIdx];

          // Determine all category variants to insert (e.g. GM, SC, 2A, etc.)
          const targetCategories = new Set([rawCategory]);
          if (CATEGORY_ALIASES[rawCategory]) {
            CATEGORY_ALIASES[rawCategory].forEach(alias => targetCategories.add(alias));
          }

          // For each matched course of this college
          for (const matchedCourse of matchedCourses) {
            for (const category of targetCategories) {
              // 1. Record keyed with college._id (internal ObjectId string)
              const docInternal = {
                collegeId: college._id.toString(),
                courseId: matchedCourse.courseId,
                courseName: matchedCourse.name,
                examCode: 'KCET',
                year: src.year,
                round: src.round,
                category: category.toUpperCase(),
                closingRank,
                source: 'official',
                status: 'verified',
                metadata: {
                  sourceUrl: src.sourceUrl,
                  sourceFile: src.fileName,
                  keaCollegeCode: currentCollegeCode,
                  keaCourseCode: twoLetterCode,
                  importedAt: new Date()
                },
                lastUpdated: new Date()
              };

              bulkOps.push({
                updateOne: {
                  filter: {
                    collegeId: docInternal.collegeId,
                    courseId: docInternal.courseId,
                    examCode: 'KCET',
                    category: docInternal.category,
                    year: docInternal.year,
                    round: docInternal.round
                  },
                  update: { $set: docInternal },
                  upsert: true
                }
              });
              fileCutoffsInserted++;

              // 2. Record keyed with college.collegeId (e.g. "E005") if available
              if (college.collegeId && college.collegeId !== college._id.toString()) {
                const docCode = { ...docInternal, collegeId: college.collegeId.toUpperCase() };
                bulkOps.push({
                  updateOne: {
                    filter: {
                      collegeId: docCode.collegeId,
                      courseId: docCode.courseId,
                      examCode: 'KCET',
                      category: docCode.category,
                      year: docCode.year,
                      round: docCode.round
                    },
                    update: { $set: docCode },
                    upsert: true
                  }
                });
              }
            }
          }
        }
      }
    }

    await parser.destroy();

    console.log(`Writing ${bulkOps.length} cutoff upsert operations to MongoDB...`);
    // Execute bulk write in batches of 5000
    const BATCH_SIZE = 5000;
    for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
      const batch = bulkOps.slice(i, i + BATCH_SIZE);
      await cutoffsColl.bulkWrite(batch, { ordered: false });
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ ${src.fileName} complete in ${elapsed}s! Extracted ${fileCutoffsInserted} cutoffs from ${collegesInPdf.size} colleges.`);
    grandTotalCutoffs += fileCutoffsInserted;

    manifest.push({
      fileName: src.fileName,
      year: src.year,
      round: src.round,
      sourceUrl: src.sourceUrl,
      publicationStatus: src.status,
      pages: numPages,
      collegesExtracted: collegesInPdf.size,
      courseRowsExtracted: fileRowsParsed,
      recordsInserted: fileCutoffsInserted,
      processedAt: new Date().toISOString()
    });
  }

  // Save manifest
  const manifestPath = path.join(SOURCE_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n======================================================`);
  console.log(`🎉 Ingestion complete!`);
  console.log(`Total Cutoffs Inserted: ${grandTotalCutoffs}`);
  console.log(`Manifest written to: ${manifestPath}`);
  console.log(`======================================================`);

  // Verify total cutoffs count in database
  const countInDb = await cutoffsColl.countDocuments({ examCode: 'KCET' });
  console.log(`Verified total KCET cutoffs in MongoDB: ${countInDb}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
