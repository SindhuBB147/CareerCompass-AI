/**
 * Run with: npx ts-node src/database/seed.ts
 * Seeds the local dev database with the four supported exams and
 * a representative set of Karnataka engineering colleges.
 */
import mongoose from 'mongoose';

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
  { name: 'R.V. College of Engineering', aliasNames: ['RVCE'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1963, aicteApproved: true,
    accreditation: { naac: 'A+', nbaCourses: ['CSE', 'ECE'], nirfRank: 99 },
    courses: [
      { courseId: 'RVCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 220000 },
      { courseId: 'RVCE-ECE', name: 'Electronics & Communication', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 210000 },
    ],
    placementSummary: [
      { year: 2025, placementPercentage: 83, averagePackage: 1524000, highestPackage: 6700000, topRecruiters: ['Google', 'Microsoft', 'Amazon', 'Cisco', 'Deloitte'] },
    ],
    infrastructure: { hostel: true, library: true, labs: ['AI Lab', 'IoT Lab'] },
    contact: { website: 'https://rvce.edu.in', address: 'Mysuru Road, Bengaluru' },
    feeBreakdown: { tuitionFee: 220000, totalAnnualFee: 220000 },
    isVerified: true },
  { name: 'B.M.S. College of Engineering', aliasNames: ['BMSCE'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1946, aicteApproved: true,
    accreditation: { naac: 'A++', nirfRank: 63 },
    courses: [
      { courseId: 'BMS-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 195000 },
      { courseId: 'BMS-ISE', name: 'Information Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 190000 },
    ],
    placementSummary: [
      { year: 2025, averagePackage: 1140000, highestPackage: 5150000, topRecruiters: ['Adobe', 'Amazon', 'Goldman Sachs', 'Cisco', 'Samsung R&D'] },
    ],
    contact: { website: 'https://bmsce.ac.in' },
    feeBreakdown: { tuitionFee: 195000, totalAnnualFee: 195000 },
    isVerified: true },
  { name: 'M.S. Ramaiah Institute of Technology', aliasNames: ['MSRIT'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1962, aicteApproved: true,
    accreditation: { naac: 'A+', nirfRank: 75 },
    courses: [
      { courseId: 'MSRIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 200000 },
    ],
    placementSummary: [
      { year: 2025, placementPercentage: 90, averagePackage: 825000, highestPackage: 5800000, topRecruiters: ['DE Shaw', 'NXP Semiconductors', 'Texas Instruments', 'Infosys', 'Cisco'] },
    ],
    contact: { website: 'https://msrit.edu' },
    feeBreakdown: { tuitionFee: 200000, totalAnnualFee: 200000 },
    isVerified: true },
  { name: 'PES University', aliasNames: ['PESU'], state: 'Karnataka', city: 'Bengaluru',
    collegeType: 'Deemed', establishedYear: 1972, aicteApproved: true,
    accreditation: { naac: 'A+', nirfRank: 101 },
    courses: [
      { courseId: 'PES-CSE', name: 'Computer Science Engineering', degreeType: 'B.Tech', intake: 480, examsAccepted: ['KCET', 'COMEDK', 'JEE'], feePerYear: 350000 },
    ],
    placementSummary: [
      { year: 2025, placementPercentage: 85, averagePackage: 1799000, highestPackage: 6500000, medianPackage: 1250000, topRecruiters: ['Google', 'Microsoft', 'Amazon', 'Deloitte', 'Flipkart'] },
    ],
    contact: { website: 'https://pes.edu' },
    feeBreakdown: { tuitionFee: 350000, totalAnnualFee: 350000 },
    isVerified: true },
  { name: 'NIE Mysore', aliasNames: ['NIE'], state: 'Karnataka', city: 'Mysuru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1946, aicteApproved: true,
    accreditation: { naac: 'B++', nirfRank: 175 },
    courses: [
      { courseId: 'NIE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 130000 },
      { courseId: 'NIE-ME', name: 'Mechanical Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 110000 },
    ],
    contact: { website: 'https://nie.ac.in' },
    feeBreakdown: { tuitionFee: 130000, totalAnnualFee: 130000 },
    isVerified: true },
  { name: 'University Visvesvaraya College of Engineering', aliasNames: ['UVCE'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'Bangalore University',
    collegeType: 'Government', establishedYear: 1917, aicteApproved: true,
    courses: [
      { courseId: 'UVCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET'], feePerYear: 40000 },
    ],
    contact: { website: 'https://uvce.ac.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/UVCE_Main_Building.jpg/250px-UVCE_Main_Building.jpg',
    feeBreakdown: { tuitionFee: 40000, totalAnnualFee: 40000 },
    isVerified: true },
  { name: 'Government S.K.S.J. Institute of Technology', aliasNames: ['GSKSJTI', 'SKSJTI'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Government', establishedYear: 1938, aicteApproved: true,
    courses: [
      { courseId: 'SKSJTI-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET'], feePerYear: 45000 },
    ],
    contact: { website: 'https://gsksjti.ac.in' },
    feeBreakdown: { tuitionFee: 45000, totalAnnualFee: 45000 },
    isVerified: true },
  { name: 'Dr. Ambedkar Institute of Technology', aliasNames: ['Dr. AIT', 'AIT'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1980, aicteApproved: true,
    accreditation: { naac: 'A+' },
    courses: [
      { courseId: 'DRAIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 150000 },
    ],
    contact: { website: 'https://drait.edu.in' },
    feeBreakdown: { tuitionFee: 150000, totalAnnualFee: 150000 },
    isVerified: true },
  { name: 'Dayananda Sagar College of Engineering', aliasNames: ['DSCE'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1979, aicteApproved: true,
    accreditation: { naac: 'A' },
    courses: [
      { courseId: 'DSCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 200000 },
    ],
    contact: { website: 'https://www.dsce.edu.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/DSCE_Logo.jpg/250px-DSCE_Logo.jpg',
    feeBreakdown: { tuitionFee: 200000, totalAnnualFee: 200000 },
    isVerified: true },
  { name: 'Bangalore Institute of Technology', aliasNames: ['BIT'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1979, aicteApproved: true,
    courses: [
      { courseId: 'BIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 190000 },
    ],
    contact: { website: 'https://bit-bangalore.edu.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d7/Bangalore_Institute_of_Technology_logo.png/250px-Bangalore_Institute_of_Technology_logo.png',
    feeBreakdown: { tuitionFee: 190000, totalAnnualFee: 190000 },
    isVerified: true },
  { name: 'Islamia Institute of Technology', aliasNames: ['IIT Bangalore', 'Islamiah Institute of Technology'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1979, aicteApproved: true,
    courses: [
      { courseId: 'ISLAMIA-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 120000 },
    ],
    feeBreakdown: { tuitionFee: 120000, totalAnnualFee: 120000 },
    isVerified: true },
  { name: 'M.V.J. College of Engineering', aliasNames: ['MVJCE'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1982, aicteApproved: true,
    accreditation: { naac: 'B++' },
    courses: [
      { courseId: 'MVJCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 180000 },
    ],
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/MVJ_College_of_Engineering.jpg/250px-MVJ_College_of_Engineering.jpg',
    feeBreakdown: { tuitionFee: 180000, totalAnnualFee: 180000 },
    isVerified: true },
  { name: 'Sir M. Visvesvaraya Institute of Technology', aliasNames: ['Sir MVIT'], state: 'Karnataka', city: 'Bengaluru', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1986, aicteApproved: true,
    accreditation: { naac: 'A' },
    courses: [
      { courseId: 'MVIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 170000 },
    ],
    contact: { website: 'https://www.sirmvit.edu' },
    feeBreakdown: { tuitionFee: 170000, totalAnnualFee: 170000 },
    isVerified: true },
  { name: 'Ghousia Engineering College', aliasNames: ['GCE Ramanagara'], state: 'Karnataka', city: 'Ramanagara', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1980, aicteApproved: true,
    courses: [
      { courseId: 'GCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 110000 },
    ],
    feeBreakdown: { tuitionFee: 110000, totalAnnualFee: 110000 },
    isVerified: true },
  { name: 'S.J.C. Institute of Technology', aliasNames: ['SJCIT'], state: 'Karnataka', city: 'Chickballapur', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1986, aicteApproved: true,
    accreditation: { naac: 'A+' },
    courses: [
      { courseId: 'SJCIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 115000 },
    ],
    contact: { website: 'https://sjcit.ac.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/SJC-Institute-of-Technology.jpg/250px-SJC-Institute-of-Technology.jpg',
    feeBreakdown: { tuitionFee: 115000, totalAnnualFee: 115000 },
    isVerified: true },
  { name: 'Dr. T. Thimmaiah Institute of Technology', aliasNames: ['Dr. TTIT', 'KGF Institute of Technology'], state: 'Karnataka', city: 'KGF', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1986, aicteApproved: true,
    accreditation: { naac: 'A' },
    courses: [
      { courseId: 'TTIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 100000 },
    ],
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Dr_T_Thimmaiah_Institute_of_Technology_-_K.G.F.jpg/250px-Dr_T_Thimmaiah_Institute_of_Technology_-_K.G.F.jpg',
    feeBreakdown: { tuitionFee: 100000, totalAnnualFee: 100000 },
    isVerified: true },
  { name: 'Siddaganga Institute of Technology', aliasNames: ['SIT Tumakuru'], state: 'Karnataka', city: 'Tumakuru', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1963, aicteApproved: true,
    accreditation: { naac: 'A++', nirfRank: 101 },
    courses: [
      { courseId: 'SIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 160000 },
    ],
    contact: { website: 'https://sit.ac.in' },
    feeBreakdown: { tuitionFee: 160000, totalAnnualFee: 160000 },
    isVerified: true },
  { name: 'Sri Siddhartha Institute of Technology', aliasNames: ['SSIT Tumakuru'], state: 'Karnataka', city: 'Tumakuru', affiliatedUniversity: 'Sri Siddhartha Academy of Higher Education',
    collegeType: 'Private', establishedYear: 1979, aicteApproved: true,
    accreditation: { naac: 'A+' },
    courses: [
      { courseId: 'SSIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 140000 },
    ],
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Post_Graduate_Block_SSIT%2C_Tumkur.JPG/250px-Post_Graduate_Block_SSIT%2C_Tumkur.JPG',
    feeBreakdown: { tuitionFee: 140000, totalAnnualFee: 140000 },
    isVerified: true },
  { name: 'Kalpataru Institute of Technology', aliasNames: ['KIT Tiptur'], state: 'Karnataka', city: 'Tiptur', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1986, aicteApproved: true,
    courses: [
      { courseId: 'KIT-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 100000 },
    ],
    feeBreakdown: { tuitionFee: 100000, totalAnnualFee: 100000 },
    isVerified: true },
  { name: 'JSS Science and Technology University', aliasNames: ['JSS STU', 'SJCE Mysuru'], state: 'Karnataka', city: 'Mysuru',
    collegeType: 'Private', establishedYear: 1963, aicteApproved: true,
    accreditation: { naac: 'A' },
    courses: [
      { courseId: 'JSSSTU-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 175000 },
    ],
    contact: { website: 'https://naac.jssstuniv.in' },
    feeBreakdown: { tuitionFee: 175000, totalAnnualFee: 175000 },
    isVerified: true },
  { name: 'PES College of Engineering', aliasNames: ['PESCE Mandya'], state: 'Karnataka', city: 'Mandya', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1962, aicteApproved: true,
    accreditation: { naac: 'A' },
    courses: [
      { courseId: 'PESCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 130000 },
    ],
    contact: { website: 'https://pesce.ac.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Pesce_college.JPG/250px-Pesce_college.JPG',
    feeBreakdown: { tuitionFee: 130000, totalAnnualFee: 130000 },
    isVerified: true },
  { name: 'Malnad College of Engineering', aliasNames: ['MCE Hassan'], state: 'Karnataka', city: 'Hassan', affiliatedUniversity: 'VTU',
    collegeType: 'Autonomous', establishedYear: 1960, aicteApproved: true,
    accreditation: { naac: 'B+' },
    courses: [
      { courseId: 'MCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 140000 },
    ],
    contact: { website: 'https://www.mcehassan.ac.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Malnad_College_of_Engineering_Main_Block_at_Twilight.jpg/250px-Malnad_College_of_Engineering_Main_Block_at_Twilight.jpg',
    feeBreakdown: { tuitionFee: 140000, totalAnnualFee: 140000 },
    isVerified: true },
  { name: 'Tontadarya College of Engineering', aliasNames: ['TCE Gadag'], state: 'Karnataka', city: 'Gadag', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1997, aicteApproved: true,
    courses: [
      { courseId: 'TCE-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 95000 },
    ],
    feeBreakdown: { tuitionFee: 95000, totalAnnualFee: 95000 },
    isVerified: true },
  { name: 'Maratha Mandal Engineering College', aliasNames: ['MMEC Belagavi'], state: 'Karnataka', city: 'Belagavi', affiliatedUniversity: 'VTU',
    collegeType: 'Private', establishedYear: 1997, aicteApproved: true,
    courses: [
      { courseId: 'MMEC-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 60, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 100000 },
    ],
    feeBreakdown: { tuitionFee: 100000, totalAnnualFee: 100000 },
    isVerified: true },
  { name: 'KLE Technological University', aliasNames: ['KLE Tech', 'BVBCET'], state: 'Karnataka', city: 'Hubballi',
    collegeType: 'Deemed', establishedYear: 1947, aicteApproved: true,
    accreditation: { naac: 'A++', nirfRank: 151 },
    courses: [
      { courseId: 'KLETECH-CSE', name: 'Computer Science Engineering', degreeType: 'B.E.', intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 210000 },
    ],
    contact: { website: 'https://www.kletech.ac.in' },
    bannerImage: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/KLE_Technological_University_Logo.png/250px-KLE_Technological_University_Logo.png',
    feeBreakdown: { tuitionFee: 210000, totalAnnualFee: 210000 },
    isVerified: true },
];

const SAMPLE_CUTOFFS = [
  { collegeId: '', courseId: 'RVCE-CSE', examCode: 'KCET', year: 2025, round: 1, category: 'General', openingRank: 1200, closingRank: 4950, source: 'official' },
  { collegeId: '', courseId: 'RVCE-CSE', examCode: 'KCET', year: 2024, round: 1, category: 'General', openingRank: 1100, closingRank: 5200, source: 'official' },
  { collegeId: '', courseId: 'RVCE-CSE', examCode: 'KCET', year: 2023, round: 1, category: 'General', openingRank: 1300, closingRank: 5500, source: 'official' },
  { collegeId: '', courseId: 'BMS-CSE', examCode: 'KCET', year: 2025, round: 1, category: 'General', openingRank: 2000, closingRank: 6200, source: 'official' },
  { collegeId: '', courseId: 'PES-CSE', examCode: 'KCET', year: 2025, round: 1, category: 'General', openingRank: 800, closingRank: 3500, source: 'official' },
];

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

  // Seed cutoffs (link to first college for RVCE cutoffs)
  const rvceId = insertedColleges.insertedIds[0].toString();
  const bmsId = insertedColleges.insertedIds[1].toString();
  const pesId = insertedColleges.insertedIds[3].toString();

  const cutoffs = SAMPLE_CUTOFFS.map(c => {
    if (c.courseId.startsWith('RVCE')) return { ...c, collegeId: rvceId };
    if (c.courseId.startsWith('BMS')) return { ...c, collegeId: bmsId };
    if (c.courseId.startsWith('PES')) return { ...c, collegeId: pesId };
    return c;
  });

  const cutoffsColl = mongoose.connection.collection('cutoffs');
  await cutoffsColl.deleteMany({});
  await cutoffsColl.insertMany(cutoffs);
  console.log(`Seeded ${cutoffs.length} cutoffs`);

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
