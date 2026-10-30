import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/career-compass-dev';

// ── CLI flags ───────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function cleanCollegeNameAndAddr(raw: string) {
  let nameStr = raw.replace(/^"|"$/g, '').trim();
  // Remove trailing UNAIDED / NT tags that are part of ownership, not the name
  nameStr = nameStr.replace(/\s+(UNAIDED|NT)$/i, '').trim();

  const parts = nameStr.split(',').map(p => p.trim());
  const mainName = parts[0];
  const address = parts.slice(1).join(', ').trim();

  return { mainName, address, fullText: nameStr };
}

// ── Known Karnataka cities for address-based city extraction ────────────────
const KNOWN_CITIES = [
  'Bengaluru', 'Bangalore', 'Mangalore', 'Mangaluru', 'Mysore', 'Mysuru', 'Hassan',
  'Kolar', 'Davanagere', 'Gulbarga', 'Kalaburagi', 'Raichur', 'Bellary', 'Ballari',
  'Tumkur', 'Tumakuru', 'Bijapur', 'Vijayapura', 'Shivamogga', 'Shimoga', 'Dharwad',
  'Hubli', 'Hubballi', 'Belgaum', 'Belagavi', 'Mandya', 'Udupi', 'Bidar', 'Bagalkot',
  'Chitradurga', 'Chikmagalur', 'Chikkamagaluru', 'Gokak', 'Sirsi', 'Karwar', 'Gadag',
  'Haveri', 'Koppal', 'Yadgir', 'Chamarajnagar', 'Chikkaballapur', 'Ramanagara',
  'Gowribidanur', 'Moodbidri', 'Sullia', 'Sagar', 'Madhugiri', 'Ankola',
  'Puttur', 'KGF', 'Anekal', 'Devanahalli', 'Yelahanka', 'Manipal',
];

// Map of common city name variants to canonical names
const CITY_CANONICAL: Record<string, string> = {
  'bangalore': 'Bengaluru', 'bengaluru': 'Bengaluru',
  'mangalore': 'Mangaluru', 'mangaluru': 'Mangaluru',
  'mysore': 'Mysuru', 'mysuru': 'Mysuru',
  'gulbarga': 'Kalaburagi', 'kalaburagi': 'Kalaburagi',
  'bellary': 'Ballari', 'ballari': 'Ballari',
  'tumkur': 'Tumakuru', 'tumakuru': 'Tumakuru',
  'bijapur': 'Vijayapura', 'vijayapura': 'Vijayapura',
  'shimoga': 'Shivamogga', 'shivamogga': 'Shivamogga',
  'hubli': 'Hubballi', 'hubballi': 'Hubballi',
  'belgaum': 'Belagavi', 'belagavi': 'Belagavi',
};

// Map city → district
const CITY_DISTRICT: Record<string, string> = {
  'Bengaluru': 'Bengaluru Urban', 'Mangaluru': 'Dakshina Kannada',
  'Mysuru': 'Mysuru', 'Hassan': 'Hassan', 'Kolar': 'Kolar',
  'Davanagere': 'Davanagere', 'Kalaburagi': 'Kalaburagi',
  'Raichur': 'Raichur', 'Ballari': 'Ballari',
  'Tumakuru': 'Tumakuru', 'Vijayapura': 'Vijayapura',
  'Shivamogga': 'Shivamogga', 'Dharwad': 'Dharwad',
  'Hubballi': 'Dharwad', 'Belagavi': 'Belagavi',
  'Mandya': 'Mandya', 'Udupi': 'Udupi', 'Bidar': 'Bidar',
  'Bagalkot': 'Bagalkot', 'Chitradurga': 'Chitradurga',
  'Chikkamagaluru': 'Chikkamagaluru', 'Gadag': 'Gadag',
  'Haveri': 'Haveri', 'Koppal': 'Koppal', 'Yadgir': 'Yadgir',
  'Chamarajnagar': 'Chamarajanagar', 'Chikkaballapur': 'Chikkaballapura',
  'Ramanagara': 'Ramanagara', 'Moodbidri': 'Dakshina Kannada',
  'Sullia': 'Dakshina Kannada', 'Sagar': 'Shivamogga',
  'Madhugiri': 'Tumakuru', 'Ankola': 'Uttara Kannada',
  'KGF': 'Kolar', 'Manipal': 'Udupi', 'Sirsi': 'Uttara Kannada',
  'Karwar': 'Uttara Kannada', 'Puttur': 'Dakshina Kannada',
  'Gokak': 'Belagavi',
};

function extractCity(fullAddress: string): string {
  // Try to match "City - PIN" pattern
  const pinMatch = fullAddress.match(/,\s*([A-Za-z\s]+)\s*-\s*(\d{3}\s*\d{3}|\d{5,6})/);
  if (pinMatch) {
    const raw = pinMatch[1].trim().toLowerCase();
    if (CITY_CANONICAL[raw]) return CITY_CANONICAL[raw];
    const found = KNOWN_CITIES.find(c => c.toLowerCase() === raw);
    if (found) return found;
  }
  // Fallback: search for any known city in the address
  for (const c of KNOWN_CITIES) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(fullAddress)) {
      const canonical = CITY_CANONICAL[c.toLowerCase()];
      return canonical || c;
    }
  }
  return 'Bengaluru'; // Safe fallback for Karnataka
}

function extractDistrict(city: string): string | undefined {
  return CITY_DISTRICT[city] ?? undefined;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function runImport() {
  if (DRY_RUN) console.log('=== DRY RUN MODE — no database changes will be made ===\n');

  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  // Resolve CSV path relative to this script's location
  const csvPath = path.resolve(__dirname, '../data/karnataka_bsc_nursing_seat_matrix_2025.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
  const header = parseCSVLine(lines[0]);

  const fieldIdx: Record<string, number> = {};
  header.forEach((h, idx) => {
    fieldIdx[h] = idx;
  });

  // ── Parse CSV into college-level aggregates ──────────────────────────────
  const collegesMap = new Map<string, {
    code: string;
    rawNameAddr: string;
    courseType: string;
    kkRow: string[] | null;
    rkRow: string[] | null;
    totalSeats: number;
  }>();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = parseCSVLine(lines[i]);
    const code = f[fieldIdx['college_code']];
    const nameAddr = f[fieldIdx['college_name_address']];
    const courseType = f[fieldIdx['course_type']];
    const seatType = f[fieldIdx['seat_type']];
    const totalSeats = parseFloat(f[fieldIdx['total_seats']]) || 0;

    if (!code) continue;

    if (!collegesMap.has(code)) {
      collegesMap.set(code, {
        code,
        rawNameAddr: nameAddr,
        courseType,
        kkRow: null,
        rkRow: null,
        totalSeats: 0,
      });
    }

    const item = collegesMap.get(code)!;
    if (seatType === 'KK') {
      item.kkRow = f;
    } else if (seatType === 'RK') {
      item.rkRow = f;
      item.totalSeats = totalSeats;
    }
  }

  console.log(`Parsed ${collegesMap.size} colleges from KEA seat matrix CSV.\n`);

  // ── Helper: parse category seat breakdown from a CSV row ─────────────────
  const parseSeats = (row: string[] | null) => {
    if (!row) return null;
    return {
      cat1_g: parseInt(row[fieldIdx['cat1_g']]) || 0,
      cat1_r: parseInt(row[fieldIdx['cat1_r']]) || 0,
      cat1_k: parseInt(row[fieldIdx['cat1_k']]) || 0,
      cat2a_g: parseInt(row[fieldIdx['2a_g']]) || 0,
      cat2a_r: parseInt(row[fieldIdx['2a_r']]) || 0,
      cat2a_k: parseInt(row[fieldIdx['2a_k']]) || 0,
      cat2b_g: parseInt(row[fieldIdx['2b_g']]) || 0,
      cat2b_r: parseInt(row[fieldIdx['2b_r']]) || 0,
      cat2b_k: parseInt(row[fieldIdx['2b_k']]) || 0,
      cat3a_g: parseInt(row[fieldIdx['3a_g']]) || 0,
      cat3a_r: parseInt(row[fieldIdx['3a_r']]) || 0,
      cat3a_k: parseInt(row[fieldIdx['3a_k']]) || 0,
      cat3b_g: parseInt(row[fieldIdx['3b_g']]) || 0,
      cat3b_r: parseInt(row[fieldIdx['3b_r']]) || 0,
      cat3b_k: parseInt(row[fieldIdx['3b_k']]) || 0,
      st_g: parseInt(row[fieldIdx['st_g']]) || 0,
      st_r: parseInt(row[fieldIdx['st_r']]) || 0,
      st_k: parseInt(row[fieldIdx['st_k']]) || 0,
      sc_g: parseInt(row[fieldIdx['sc_g']]) || 0,
      sc_r: parseInt(row[fieldIdx['sc_r']]) || 0,
      sc_k: parseInt(row[fieldIdx['sc_k']]) || 0,
      gm_g: parseInt(row[fieldIdx['gm_g']]) || 0,
      gm_r: parseInt(row[fieldIdx['gm_r']]) || 0,
      gm_k: parseInt(row[fieldIdx['gm_k']]) || 0,
      total: parseFloat(row[fieldIdx['kk_rk_total']]) || 0,
    };
  };

  const parseSpecial = (row: string[] | null) => {
    if (!row) return {};
    const special: Record<string, number> = {};
    const keys = [
      'opn', 'mc1', 'ph', 'ncc', 'sports', 'scouts_guides',
      'defence', 'defence_karnataka', 'defence_ex_defence',
      'anglo_indian', 'capf', 'xcapf', 'gmph'
    ];
    for (const k of keys) {
      const val = parseFloat(row[fieldIdx[k]]) || 0;
      if (val > 0) special[k] = val;
    }
    return special;
  };

  // ── Load existing colleges for matching ──────────────────────────────────
  const existingColleges = await db.collection('colleges').find({}).toArray();
  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  const matchLog: string[] = [];
  const createLog: string[] = [];

  for (const [code, item] of collegesMap.entries()) {
    const { mainName, address, fullText } = cleanCollegeNameAndAddr(item.rawNameAddr);
    const city = extractCity(fullText);
    const district = extractDistrict(city);
    const collegeType = (item.courseType && item.courseType.includes('GOVERNME')) ? 'Government' : 'Private';

    const kkSeats = parseSeats(item.kkRow);
    const rkSeats = parseSeats(item.rkRow);
    const specialQuotaSeats = parseSpecial(item.rkRow);

    const seatMatrix = {
      academicYear: '2025-26',
      totalSeats: item.totalSeats,
      kkSeats,
      rkSeats,
      specialQuotaSeats,
    };

    const courseObj = {
      courseId: `${code.toUpperCase()}-BSC-NURSING`,
      name: 'B.Sc. Nursing',
      degreeType: 'B.Sc. Nursing',
      durationYears: 4,
      intake: item.totalSeats,
      sanctionedIntake: item.totalSeats,
      examsAccepted: ['KCET'],
      feePerYear: null,
      eligibility: '10+2 with Physics, Chemistry, Biology and English with minimum aggregate marks as per KEA / INC norms.',
      cutoffRankSummary: null,
      discipline: 'Nursing',
      academicYear: '2025-26',
      seatMatrix,
    };

    // ── Match existing college ────────────────────────────────────────────
    // Priority: 1) collegeId match, 2) alternateAdmissionCodes match,
    //           3) name fuzzy match
    let existing = existingColleges.find(c => c.collegeId && c.collegeId.toUpperCase() === code.toUpperCase());

    if (!existing) {
      // Check if any existing college lists this code as an alternate admission code
      existing = existingColleges.find(c =>
        c.alternateAdmissionCodes?.some((ac: any) => ac.code.toUpperCase() === code.toUpperCase())
      );
      if (existing) {
        matchLog.push(`  ${code} → matched via alternateAdmissionCodes on "${existing.name}" (${existing.collegeId})`);
      }
    }

    if (!existing) {
      const normMain = mainName.toLowerCase().replace(/[^a-z0-9]/g, '');
      existing = existingColleges.find(c => {
        const normDbName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normDbName === normMain || (c.aliasNames && c.aliasNames.some((a: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === normMain));
      });
      if (existing) {
        matchLog.push(`  ${code} → matched via name fuzzy to "${existing.name}" (${existing.collegeId})`);
      }
    } else if (!matchLog.some(l => l.startsWith(`  ${code}`))) {
      matchLog.push(`  ${code} → matched via collegeId to "${existing.name}"`);
    }

    if (existing) {
      // Update existing college document — add/update B.Sc Nursing course with seat matrix
      const courses = existing.courses || [];
      const courseIdx = courses.findIndex((crc: any) =>
        crc.courseId === courseObj.courseId ||
        crc.name.toLowerCase() === 'b.sc. nursing' ||
        crc.name.toLowerCase() === 'b.sc nursing' ||
        crc.name.toLowerCase() === 'bachelor of science in nursing' ||
        crc.name.toLowerCase() === 'nursing'
      );

      if (courseIdx !== -1) {
        // Preserve existing course data, only update seat matrix and intake
        const existingCourse = courses[courseIdx];
        courses[courseIdx] = {
          ...existingCourse,
          seatMatrix,
          intake: item.totalSeats || existingCourse.intake,
          sanctionedIntake: item.totalSeats || existingCourse.sanctionedIntake,
          academicYear: '2025-26',
        };
      } else {
        courses.push(courseObj);
      }

      if (!DRY_RUN) {
        await db.collection('colleges').updateOne(
          { _id: existing._id },
          {
            $set: {
              courses,
              lastDataUpdate: new Date(),
            }
          }
        );
      }
      updatedCount++;
    } else {
      // Create new college document — only verifiable fields
      const slug = `${code.toLowerCase()}-${slugify(mainName)}-${slugify(city)}`;
      const newCollegeDoc = {
        collegeId: code.toUpperCase(),
        name: mainName,
        slug,
        aliasNames: [fullText],
        state: 'Karnataka',
        city,
        district: district || null,
        collegeType,
        affiliatedUniversity: 'RGUHS',
        // Only set fields we actually know from the CSV
        establishedYear: null,
        aicteApproved: null,
        rating: null,
        reviewsCount: null,
        campusSizeAcres: null,
        studentCount: item.totalSeats,
        facultyCount: null,
        bannerImage: '',
        logo: '',
        description: `${mainName} located in ${city}, Karnataka. ${collegeType === 'Government' ? 'A government nursing institution' : 'A private nursing institution'} offering B.Sc. Nursing under KEA counselling.`,
        highlights: ['KEA Recognized', `${collegeType} College`, `Total Seat Intake: ${item.totalSeats}`],
        accreditation: { naac: undefined, nbaCourses: [] },
        contact: {
          address: address || fullText,
          googleMapQuery: `${mainName}, ${city}, Karnataka`,
        },
        // Do NOT set fabricated fee/hostel data — leave as schema defaults (0/null)
        feeBreakdown: { tuitionFee: 0, totalAnnualFee: 0 },
        hostelInfo: {},
        gallery: [],
        courses: [courseObj],
        placementSummary: [],
        admissionProcess: [
          { stepNumber: 1, title: 'KEA Application', description: 'Register and submit application via Karnataka Examinations Authority (KEA) for B.Sc. Nursing admission.' },
          { stepNumber: 2, title: 'KCET Entrance Exam', description: 'Appear for KCET (Karnataka CET) or qualify through NEET UG as applicable.' },
          { stepNumber: 3, title: 'Counselling & Seat Allotment', description: 'Participate in KEA option entry and counselling rounds for B.Sc. Nursing seat allotment.' },
          { stepNumber: 4, title: 'Document Verification & Admission', description: 'Report to document verification centre with original certificates, then to the allotted college for admission.' },
        ],
        admissionRoutes: [
          { route: 'KCET / KEA', eligibility: '10+2 with PCB & English, min 45% aggregate', process: 'KEA Counselling Seat Allotment' },
        ],
        reviewsList: [],
        about: {
          summary: `${mainName} is a ${collegeType.toLowerCase()} nursing institution in ${city}, Karnataka offering B.Sc. Nursing under KEA seat matrix allocation.`,
          history: '', vision: '', mission: '',
        },
        campus: { description: '', architectureHighlights: [], facilities: [] },
        cutoffs: [],
        metadata: {
          dataVerified: true,
          lastVerified: new Date(),
          dataSources: ['Official KEA B.Sc Nursing Seat Matrix 2025-26'],
          dataVersion: '2025-26',
        },
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (!DRY_RUN) {
        await db.collection('colleges').insertOne(newCollegeDoc);
      }
      createdCount++;
      createLog.push(`  ${code} → "${mainName}" (${city}${district ? `, ${district}` : ''}) [${item.totalSeats} seats]`);
    }
  }

  // ── Summary Report ───────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║          NURSING SEAT MATRIX IMPORT REPORT       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Mode:              ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log(`  CSV Colleges:      ${collegesMap.size}`);
  console.log(`  Existing Updated:  ${updatedCount}`);
  console.log(`  New Created:       ${createdCount}`);
  console.log(`  Skipped:           ${skippedCount}`);
  console.log('');

  if (matchLog.length > 0) {
    console.log(`── Matched Colleges (${matchLog.length}) ──`);
    matchLog.forEach(l => console.log(l));
    console.log('');
  }

  if (createLog.length > 0 && createLog.length <= 50) {
    console.log(`── Newly Created Colleges (${createLog.length}) ──`);
    createLog.forEach(l => console.log(l));
  } else if (createLog.length > 50) {
    console.log(`── Newly Created Colleges (showing first 50 of ${createLog.length}) ──`);
    createLog.slice(0, 50).forEach(l => console.log(l));
    console.log(`  ... and ${createLog.length - 50} more`);
  }

  await mongoose.disconnect();
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
