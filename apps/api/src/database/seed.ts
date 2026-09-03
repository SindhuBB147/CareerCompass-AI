/**
 * Run with: npx ts-node src/database/seed.ts
 * Seeds the local dev database with supported exams, colleges, and the
 * official clean COMEDK cutoff dataset (comedk_cutoffs_clean.csv).
 */
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/career-compass-dev';

const EXAMS = [
  { code: 'KCET', name: 'Karnataka Common Entrance Test', conductingBody: 'Karnataka Examinations Authority', applicableStates: ['Karnataka'], year: 2026, rounds: [
    { roundNumber: 1, name: 'Round 1', choiceFillingStart: new Date('2026-07-25'), choiceFillingEnd: new Date('2026-07-30'), cutoffReleaseDate: new Date('2026-08-02'), reportingDeadline: new Date('2026-08-06'), status: 'upcoming' },
    { roundNumber: 2, name: 'Round 2', choiceFillingStart: new Date('2026-08-10'), choiceFillingEnd: new Date('2026-08-14'), cutoffReleaseDate: new Date('2026-08-17'), reportingDeadline: new Date('2026-08-21'), status: 'upcoming' },
  ], isActive: true },
  { code: 'COMEDK', name: 'Consortium of Medical, Engineering and Dental Colleges of Karnataka', conductingBody: 'COMEDK', applicableStates: ['Karnataka'], year: 2026, rounds: [
    { roundNumber: 1, name: 'Round 1', choiceFillingStart: new Date('2026-07-20'), choiceFillingEnd: new Date('2026-07-28'), status: 'upcoming' },
  ], isActive: true },
  { code: 'JEE', name: 'Joint Entrance Examination (Main)', conductingBody: 'NTA', applicableStates: ['Karnataka'], year: 2026, rounds: [], isActive: true },
  { code: 'NEET', name: 'National Eligibility cum Entrance Test', conductingBody: 'NTA', applicableStates: ['Karnataka'], year: 2026, rounds: [], isActive: true },
];

const COLLEGES = [
  { name: 'R.V. College of Engineering', aliasNames: ['RVCE'], slug: 'rvce', state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    accreditation: { naac: 'A++', nbaCourses: ['CSE', 'ECE'], nirfRank: 97 },
    courses: [
      { courseId: 'RVCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 220000 },
      { courseId: 'RVCE-ECE', name: 'Electronics & Communication', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 210000 },
    ],
    placementSummary: [
      { year: 2025, placementPercentage: 92, medianPackage: 850000, topRecruiters: ['Microsoft', 'Deloitte', 'Cisco'] },
      { year: 2024, placementPercentage: 90, medianPackage: 800000, topRecruiters: ['Amazon', 'TCS', 'Infosys'] },
    ],
    infrastructure: { hostel: true, library: true, labs: ['AI Lab', 'IoT Lab'] },
    contact: { website: 'https://rvce.edu.in', address: 'Mysuru Road, Bengaluru' },
    isVerified: true },
  { name: 'B.M.S. College of Engineering', aliasNames: ['BMSCE'], slug: 'bmsce', state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    accreditation: { naac: 'A+', nirfRank: 82 },
    courses: [
      { courseId: 'BMS-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 195000 },
      { courseId: 'BMS-ISE', name: 'Information Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 190000 },
    ],
    placementSummary: [
      { year: 2025, placementPercentage: 88, medianPackage: 750000, topRecruiters: ['Wipro', 'Infosys', 'Accenture'] },
    ],
    isVerified: true },
  { name: 'M.S. Ramaiah Institute of Technology', aliasNames: ['MSRIT'], slug: 'msrit', state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    accreditation: { naac: 'A+', nirfRank: 105 },
    courses: [
      { courseId: 'MSRIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 200000 },
    ],
    isVerified: true },
  { name: 'PES University', aliasNames: ['PESU'], slug: 'pesu', state: 'Karnataka', city: 'Bengaluru',
    accreditation: { naac: 'A+', nirfRank: 65 },
    courses: [
      { courseId: 'PES-CSE', name: 'Computer Science Engineering', degreeType: 'B.Tech', intake: 480, examsAccepted: ['KCET', 'COMEDK', 'JEE'], feePerYear: 350000 },
    ],
    placementSummary: [
      { year: 2025, placementPercentage: 85, medianPackage: 1200000, topRecruiters: ['Google', 'Microsoft', 'Amazon'] },
    ],
    isVerified: true },
  { name: 'NIE Mysore', aliasNames: ['NIE'], slug: 'nie', state: 'Karnataka', city: 'Mysuru', affiliatedUniversity: 'VTU',
    accreditation: { naac: 'A', nirfRank: 150 },
    courses: [
      { courseId: 'NIE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 130000 },
      { courseId: 'NIE-ME', name: 'Mechanical Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 110000 },
    ],
    isVerified: true },
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function findComedkCsvPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../../files/comedk_cutoffs_clean.csv'),
    path.resolve(process.cwd(), '../files/comedk_cutoffs_clean.csv'),
    path.resolve(process.cwd(), 'files/comedk_cutoffs_clean.csv'),
    'C:/Users/sindh/Downloads/career-compass-ai/files/comedk_cutoffs_clean.csv',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findKcetCsvPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../../files/kcet_cutoffs_clean.csv'),
    path.resolve(process.cwd(), '../files/kcet_cutoffs_clean.csv'),
    path.resolve(process.cwd(), 'files/kcet_cutoffs_clean.csv'),
    'C:/Users/sindh/Downloads/career-compass-ai/files/kcet_cutoffs_clean.csv',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to', MONGO_URI);

  // Seed exams
  const examsColl = mongoose.connection.collection('exams');
  await examsColl.deleteMany({});
  await examsColl.insertMany(EXAMS);
  console.log(`Seeded ${EXAMS.length} exams`);

  // Seed colleges
  const collegesColl = mongoose.connection.collection('colleges');
  await collegesColl.deleteMany({});
  const insertedColleges = await collegesColl.insertMany(COLLEGES);
  console.log(`Seeded ${COLLEGES.length} colleges`);

  const cutoffsColl = mongoose.connection.collection('cutoffs');
  await cutoffsColl.deleteMany({});

  // Seed KCET cutoffs from kcet_cutoffs_clean.csv
  const kcetCsvPath = findKcetCsvPath();
  let kcetImported = 0;
  let kcetRejected = 0;
  const kcetRejectionDetails: string[] = [];

  if (kcetCsvPath) {
    const fileContent = fs.readFileSync(kcetCsvPath, 'utf-8');
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length > 1) {
      const header = parseCsvLine(lines[0]);
      const idxExam = header.indexOf('exam');
      const idxYear = header.indexOf('year');
      const idxRound = header.indexOf('round');
      const idxCounselling = header.indexOf('counsellingAuthority');
      const idxCollegeCode = header.indexOf('collegeCode');
      const idxCollegeName = header.indexOf('collegeName');
      const idxCourseCode = header.indexOf('courseCode');
      const idxCourseName = header.indexOf('courseName');
      const idxCategory = header.indexOf('category');
      const idxQuota = header.indexOf('quota');
      const idxOpeningRank = header.indexOf('openingRank');
      const idxClosingRank = header.indexOf('closingRank');
      const idxState = header.indexOf('state');
      const idxCollegeType = header.indexOf('collegeType');
      const idxSource = header.indexOf('source');

      const kcetRows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < header.length) {
          kcetRejected++;
          kcetRejectionDetails.push(`Line ${i + 1}: expected ${header.length} fields, got ${row.length}`);
          continue;
        }

        const year = parseInt(row[idxYear], 10);
        const closingRank = parseInt(row[idxClosingRank], 10);
        if (isNaN(year) || isNaN(closingRank)) {
          kcetRejected++;
          kcetRejectionDetails.push(`Line ${i + 1}: invalid year (${row[idxYear]}) or closingRank (${row[idxClosingRank]})`);
          continue;
        }

        const collegeCode = row[idxCollegeCode];
        const courseCode = row[idxCourseCode];
        if (!collegeCode || !courseCode) {
          kcetRejected++;
          kcetRejectionDetails.push(`Line ${i + 1}: missing collegeCode (${collegeCode}) or courseCode (${courseCode})`);
          continue;
        }

        const openingRankVal = row[idxOpeningRank];
        const openingRank = (openingRankVal && !isNaN(parseInt(openingRankVal, 10))) ? parseInt(openingRankVal, 10) : null;

        kcetRows.push({
          collegeId: collegeCode,
          courseId: courseCode,
          examCode: row[idxExam] ? row[idxExam].toUpperCase().replace(/"/g, '') : 'KCET',
          counsellingAuthority: row[idxCounselling] ? row[idxCounselling].replace(/"/g, '') : 'KEA',
          year,
          round: row[idxRound] ? row[idxRound].replace(/"/g, '') : '1',
          category: row[idxCategory] ? row[idxCategory].toUpperCase().replace(/"/g, '') : 'GM',
          collegeCode,
          collegeName: row[idxCollegeName] ? row[idxCollegeName].replace(/"/g, '') : collegeCode,
          courseCode,
          courseName: row[idxCourseName] ? row[idxCourseName].replace(/"/g, '') : courseCode,
          openingRank,
          closingRank,
          state: row[idxState] ? row[idxState].replace(/"/g, '') : 'Karnataka',
          collegeType: row[idxCollegeType] ? row[idxCollegeType].replace(/"/g, '') : 'Government',
          quota: row[idxQuota] ? row[idxQuota].replace(/"/g, '') : null,
          source: row[idxSource] ? row[idxSource].replace(/"/g, '') : 'kcet_cutoffs_clean.csv',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (kcetRows.length > 0) {
        await cutoffsColl.insertMany(kcetRows);
        kcetImported = kcetRows.length;
        console.log(`Ingested ${kcetImported} official KCET cutoffs from ${path.basename(kcetCsvPath)}`);
      }
    }
  }

  // Ingest clean COMEDK CSV records
  const csvPath = findComedkCsvPath();
  let comedkImported = 0;
  let comedkRejected = 0;
  const comedkRejectionDetails: string[] = [];

  if (csvPath) {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length > 1) {
      const header = parseCsvLine(lines[0]);
      const idxYear = header.indexOf('year');
      const idxRound = header.indexOf('round');
      const idxExam = header.indexOf('exam');
      const idxCollegeCode = header.indexOf('college_code');
      const idxCollegeNameNorm = header.indexOf('college_name_normalized');
      const idxCategory = header.indexOf('seat_category');
      const idxCourseRaw = header.indexOf('course_raw');
      const idxCourseNorm = header.indexOf('course_normalized');
      const idxClosingRank = header.indexOf('closing_rank');
      const idxSource = header.indexOf('source_document');

      const comedkRows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < 10) {
          comedkRejected++;
          comedkRejectionDetails.push(`Line ${i + 1}: expected at least 10 fields, got ${row.length}`);
          continue;
        }

        const year = parseInt(row[idxYear], 10);
        const closingRank = parseInt(row[idxClosingRank], 10);
        if (isNaN(year) || isNaN(closingRank)) {
          comedkRejected++;
          comedkRejectionDetails.push(`Line ${i + 1}: invalid year (${row[idxYear]}) or closingRank (${row[idxClosingRank]})`);
          continue;
        }

        const collegeCode = row[idxCollegeCode];
        const courseNorm = row[idxCourseNorm];

        comedkRows.push({
          collegeId: collegeCode,
          courseId: courseNorm,
          examCode: row[idxExam] ? row[idxExam].toUpperCase() : 'COMEDK',
          counsellingAuthority: 'COMEDK',
          year,
          round: row[idxRound],
          category: row[idxCategory],
          collegeCode,
          collegeName: row[idxCollegeNameNorm] || collegeCode,
          courseCode: courseNorm,
          courseName: row[idxCourseRaw] || courseNorm,
          openingRank: null,
          closingRank,
          state: 'Karnataka',
          collegeType: 'Private',
          source: row[idxSource] || 'comedk_cutoffs_clean.csv',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (comedkRows.length > 0) {
        await cutoffsColl.insertMany(comedkRows);
        comedkImported = comedkRows.length;
        console.log(`Ingested ${comedkImported} official COMEDK cutoffs from ${path.basename(csvPath)}`);
      }
    }
  }

  if (kcetRejected > 0) {
    console.log(`[Validation Report] KCET Rejected rows: ${kcetRejected}`);
    console.log('Sample KCET rejections:', kcetRejectionDetails.slice(0, 5));
  }
  if (comedkRejected > 0) {
    console.log(`[Validation Report] COMEDK Rejected rows: ${comedkRejected}`);
    console.log('Sample COMEDK rejections:', comedkRejectionDetails.slice(0, 5));
  }

  // Seed sample scholarships
  const scholarshipsColl = mongoose.connection.collection('scholarships');
  await scholarshipsColl.deleteMany({});
  await scholarshipsColl.insertMany([
    { name: 'National Merit-cum-Means Scholarship', provider: 'government', description: 'For meritorious students from economically weaker sections.',
      eligibility: { categories: ['General', 'OBC', 'SC', 'ST', 'EWS'], maxIncome: 800000, states: ['Karnataka'], exams: ['KCET'] },
      awardAmount: { type: 'fixed', value: 50000 }, applicationDeadline: new Date('2026-09-15'), isActive: true },
    { name: 'Karnataka SC/ST Scholarship', provider: 'government', description: 'Full fee waiver for SC/ST students.',
      eligibility: { categories: ['SC', 'ST'], states: ['Karnataka'], exams: ['KCET', 'COMEDK'] },
      awardAmount: { type: 'percentage', value: 100 }, applicationDeadline: new Date('2026-10-01'), isActive: true },
  ]);
  console.log('Seeded 2 scholarships');

  await mongoose.disconnect();
  console.log('Seed complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });
