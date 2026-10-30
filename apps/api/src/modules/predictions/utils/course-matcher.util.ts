/**
 * Resolves the human-facing course/discipline labels used by the
 * Admission Probability Predictor's form (KCET's ~30 engineering
 * specializations, COMEDK's 13 groupings, NEET's 12 degree types) into
 * matches against the actual `Course` documents in the college dataset,
 * whose `name`/`degreeType`/`discipline` fields don't exactly equal any
 * of those UI labels (e.g. "AI & ML" vs the DB's "Artificial Intelligence
 * & Data Science"). Matching is keyword/alias based, case-insensitive.
 */

export interface CourseAliasEntry {
  label: string;
  keywords: string[];
  degreeType?: string;
}

export interface DisciplineOption {
  label: string;
  disciplineValue: string;
  degreeTypeHint?: string;
}

export interface MatchableCourse {
  name: string;
  degreeType: string;
  discipline?: string;
}

// ── KCET — Discipline (first field) ─────────────────────────────────────────

export const KCET_DISCIPLINE_OPTIONS: DisciplineOption[] = [
  { label: 'Engineering', disciplineValue: 'Engineering' },
  { label: 'BNYS', disciplineValue: 'Naturopathy', degreeTypeHint: 'BNYS' },
  { label: 'NATA (Architecture)', disciplineValue: 'Architecture', degreeTypeHint: 'B.Arch' },
  { label: 'Agriculture B.Sc', disciplineValue: 'Agriculture', degreeTypeHint: 'B.Sc Agriculture' },
  { label: 'Veterinary Science', disciplineValue: 'Veterinary', degreeTypeHint: 'B.V.Sc & A.H' },
  { label: 'Agriculture B.Sc (Practical)', disciplineValue: 'Agriculture', degreeTypeHint: 'B.Sc Agriculture' },
  { label: 'Veterinary (Practical)', disciplineValue: 'Veterinary', degreeTypeHint: 'B.V.Sc & A.H' },
  { label: 'B.Sc Nursing', disciplineValue: 'Nursing', degreeTypeHint: 'B.Sc Nursing' },
  { label: 'B-Pharma', disciplineValue: 'Pharmacy', degreeTypeHint: 'B.Pharm' },
  { label: 'Pharma-D', disciplineValue: 'Pharmacy', degreeTypeHint: 'Pharma-D' },
  { label: 'Lateral Entry B-Pharma', disciplineValue: 'Pharmacy', degreeTypeHint: 'B.Pharm' },
];

export function resolveDisciplineOption(label: string): DisciplineOption | undefined {
  return KCET_DISCIPLINE_OPTIONS.find(d => d.label.toLowerCase() === label.toLowerCase());
}

// ── KCET — Preferred Courses (Engineering only) ─────────────────────────────

export const KCET_ENGINEERING_COURSE_OPTIONS: CourseAliasEntry[] = [
  { label: 'Computer Science & Engineering (CSE)', keywords: ['computer science'] },
  { label: 'Information Science & Engineering (ISE)', keywords: ['information science'] },
  { label: 'Artificial Intelligence & Machine Learning (AI & ML)', keywords: ['artificial intelligence & machine learning', 'machine learning', 'ai & ml', 'ai&ml'] },
  { label: 'Artificial Intelligence & Data Science (AI & DS)', keywords: ['artificial intelligence & data science', 'ai & ds', 'ai&ds', 'artificial intelligence and data science'] },
  { label: 'Computer Science & Engineering – Data Science', keywords: ['data science'] },
  { label: 'Computer Science & Engineering – Cyber Security', keywords: ['cyber security'] },
  { label: 'Computer Science & Engineering – Internet of Things (IoT)', keywords: ['internet of things', ' iot'] },
  { label: 'Computer Science & Engineering – Artificial Intelligence', keywords: ['artificial intelligence'] },
  { label: 'Computer Engineering', keywords: ['computer engineering'] },
  { label: 'Electronics & Communication Engineering (ECE)', keywords: ['electronics & communication', 'electronics and communication'] },
  { label: 'Electronics & Telecommunication Engineering', keywords: ['telecommunication'] },
  { label: 'Electronics Engineering', keywords: ['electronics engineering'] },
  { label: 'VLSI Design & Technology', keywords: ['vlsi'] },
  { label: 'Electronics & Instrumentation Engineering', keywords: ['instrumentation'] },
  { label: 'Electrical & Electronics Engineering (EEE)', keywords: ['electrical & electronics', 'electrical and electronics'] },
  { label: 'Mechanical Engineering', keywords: ['mechanical'] },
  { label: 'Civil Engineering', keywords: ['civil'] },
  { label: 'Chemical Engineering', keywords: ['chemical engineering'] },
  { label: 'Industrial & Production Engineering', keywords: ['industrial & production', 'production engineering'] },
  { label: 'Industrial Engineering & Management', keywords: ['industrial engineering'] },
  { label: 'Aerospace Engineering', keywords: ['aerospace'] },
  { label: 'Automobile Engineering', keywords: ['automobile'] },
  { label: 'Mechatronics Engineering', keywords: ['mechatronics'] },
  { label: 'Robotics & Automation Engineering', keywords: ['robotics'] },
  { label: 'Biotechnology', keywords: ['biotechnology'] },
  { label: 'Biomedical Engineering', keywords: ['biomedical'] },
  { label: 'Environmental Engineering', keywords: ['environmental engineering'] },
  { label: 'Textile Technology', keywords: ['textile'] },
  { label: 'Construction Technology', keywords: ['construction technology'] },
  { label: 'Mining Engineering', keywords: ['mining'] },
  { label: 'Polymer Science & Engineering', keywords: ['polymer'] },
  { label: 'Printing Technology', keywords: ['printing'] },
];

// ── COMEDK — Preferred Courses ──────────────────────────────────────────────

export const COMEDK_COURSE_OPTIONS: CourseAliasEntry[] = [
  { label: 'Computer Science & IT', keywords: ['computer science', 'information science', 'information technology'] },
  { label: 'Artificial Intelligence & Data Science', keywords: ['artificial intelligence', 'data science'] },
  { label: 'Cyber Security / Emerging Technologies', keywords: ['cyber security', 'internet of things', 'blockchain'] },
  { label: 'Electronics & Communication', keywords: ['electronics'] },
  { label: 'Electrical', keywords: ['electrical'] },
  { label: 'Mechanical / Manufacturing / Automation', keywords: ['mechanical', 'manufacturing', 'automation', 'mechatronics', 'robotics'] },
  { label: 'Civil / Construction / Infrastructure', keywords: ['civil', 'construction', 'infrastructure'] },
  { label: 'Aerospace / Automobile / Marine', keywords: ['aerospace', 'automobile', 'marine'] },
  { label: 'Chemical / Materials', keywords: ['chemical', 'materials', 'polymer'] },
  { label: 'Biotechnology / Biomedical', keywords: ['biotechnology', 'biomedical'] },
  { label: 'Agriculture', keywords: ['agriculture'] },
  { label: 'Textile', keywords: ['textile'] },
  { label: 'Design / Planning', keywords: ['design', 'planning', 'architecture'] },
];

// ── NEET — Preferred Courses ─────────────────────────────────────────────────

export const NEET_COURSE_OPTIONS: CourseAliasEntry[] = [
  { label: 'MBBS', keywords: ['mbbs', 'bachelor of medicine'], degreeType: 'MBBS' },
  { label: 'BDS', keywords: ['bds', 'dental'], degreeType: 'BDS' },
  { label: 'BAMS', keywords: ['bams', 'ayurved'], degreeType: 'BAMS' },
  { label: 'BUMS', keywords: ['bums', 'unani'], degreeType: 'BUMS' },
  { label: 'BHMS', keywords: ['bhms', 'homeopath'], degreeType: 'BHMS' },
  { label: 'BNYS', keywords: ['bnys', 'naturopathy'], degreeType: 'BNYS' },
  { label: 'B.V.Sc & A.H', keywords: ['veterinary'], degreeType: 'B.V.Sc & A.H' },
  { label: 'B.Pharm', keywords: ['pharm'], degreeType: 'B.Pharm' },
  { label: 'Pharma-D', keywords: ['pharma-d', 'pharm.d'], degreeType: 'Pharma-D' },
  { label: 'B.Sc Nursing', keywords: ['nursing'], degreeType: 'B.Sc Nursing' },
  { label: 'Allied Health Sciences', keywords: ['allied health'], degreeType: 'B.Sc Allied Health Sciences' },
  { label: 'Physiotherapy', keywords: ['physiotherapy'], degreeType: 'BPT' },
];

export type SupportedExam = 'KCET' | 'COMEDK' | 'NEET' | 'JEE';

export function courseOptionsForExam(examCode: SupportedExam): CourseAliasEntry[] {
  if (examCode === 'KCET') return KCET_ENGINEERING_COURSE_OPTIONS;
  if (examCode === 'COMEDK') return COMEDK_COURSE_OPTIONS;
  if (examCode === 'JEE') return KCET_ENGINEERING_COURSE_OPTIONS;
  return NEET_COURSE_OPTIONS;
}

/** True if `course` matches at least one of the selected option labels. */
export function courseMatchesSelection(
  course: MatchableCourse,
  selectedLabels: string[],
  optionSet: CourseAliasEntry[],
): boolean {
  // Support matching by full label, keywords, or short code fragments within the label (e.g., "CSE" matches "Computer Science & Engineering (CSE)")
  const chosen = optionSet.filter(o =>
    selectedLabels.some(s => {
      const sel = s.trim().toLowerCase();
      // Direct label match
      if (sel === o.label.toLowerCase()) return true;
      // Short code inside label
      if (o.label.toLowerCase().includes(sel)) return true;
      // Keyword match (allow short codes)
      return o.keywords.some(k => k.toLowerCase() === sel);
    })
  );
  if (chosen.length === 0) return false;

  const nameLower = course.name.toLowerCase();
  const degreeLower = (course.degreeType || '').toLowerCase();

  return chosen.some(opt => {
    if (opt.degreeType && degreeLower === opt.degreeType.toLowerCase()) return true;
    return opt.keywords.some(kw => nameLower.includes(kw.toLowerCase()));
  });
}

/** True if `course.discipline` matches the resolved KCET discipline value (defaulting missing discipline to 'Engineering'). */
export function courseMatchesDiscipline(course: MatchableCourse, disciplineValue: string): boolean {
  return (course.discipline || 'Engineering') === disciplineValue;
}

// ── Category taxonomies (vertical reservation) per exam ─────────────────────

export const KCET_CATEGORIES = ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B'];
export const NEET_CATEGORIES = ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'EWS'];
export const JEE_CATEGORIES = ['GM', 'OBC', 'SC', 'ST', 'EWS'];
// COMEDK's source calls these seat types. Verified data currently includes GM
// and KKR records across 2024 Round 2 Phase 1 and Round 3.
export const COMEDK_SEAT_TYPES = ['GM', 'KKR'];
export const COMEDK_MERIT_CATEGORY = 'GM';

export function allowedCategoriesForExam(examCode: SupportedExam): string[] | null {
  if (examCode === 'KCET') return KCET_CATEGORIES;
  if (examCode === 'COMEDK') return COMEDK_SEAT_TYPES;
  if (examCode === 'NEET') return NEET_CATEGORIES;
  if (examCode === 'JEE') return JEE_CATEGORIES;
  return null;
}

// ── Horizontal (additional) reservation options ─────────────────────────────

export const KCET_HORIZONTAL_RESERVATIONS = [
  'Rural Quota', 'Kannada Medium', 'Kalyana Karnataka', 'PwD', 'Defence / Ex-Defence',
  'NCC', 'Sports', 'CAPF', 'CRPF', 'CISF', 'BSF', 'ITBP',
  'Jammu & Kashmir Migrants', 'Linguistic Minority', 'Religious Minority',
];

export const NEET_SPECIAL_RESERVATIONS = [
  'PwD', 'Defence / Ex-Defence', 'NCC', 'Sports', 'Rural', 'Kannada Medium', 'Kalyana Karnataka',
];
