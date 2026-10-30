// Mirrors apps/api/src/modules/predictions/utils/course-matcher.util.ts —
// labels here must match the backend's option labels exactly (case-insensitive),
// since the backend resolves selections by label lookup, not by ID.

export const EXAM_OPTIONS = [
  { value: 'KCET', label: 'KCET (Karnataka CET)' },
  { value: 'COMEDK', label: 'COMEDK UGET' },
  { value: 'NEET', label: 'NEET (Medical / Dental / AYUSH)' },
  { value: 'JEE', label: 'JEE Main' },
] as const;

export type ExamCode = 'KCET' | 'COMEDK' | 'NEET' | 'JEE';

export const KCET_DISCIPLINES = [
  'Engineering', 'BNYS', 'NATA (Architecture)', 'Agriculture B.Sc', 'Veterinary Science',
  'Agriculture B.Sc (Practical)', 'Veterinary (Practical)', 'B.Sc Nursing', 'B-Pharma',
  'Pharma-D', 'Lateral Entry B-Pharma',
];

export const KCET_ENGINEERING_COURSES = [
  'Computer Science & Engineering (CSE)',
  'Information Science & Engineering (ISE)',
  'Artificial Intelligence & Machine Learning (AI & ML)',
  'Artificial Intelligence & Data Science (AI & DS)',
  'Computer Science & Engineering – Data Science',
  'Computer Science & Engineering – Cyber Security',
  'Computer Science & Engineering – Internet of Things (IoT)',
  'Computer Science & Engineering – Artificial Intelligence',
  'Computer Engineering',
  'Electronics & Communication Engineering (ECE)',
  'Electronics & Telecommunication Engineering',
  'Electronics Engineering',
  'VLSI Design & Technology',
  'Electronics & Instrumentation Engineering',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Industrial & Production Engineering',
  'Industrial Engineering & Management',
  'Aerospace Engineering',
  'Automobile Engineering',
  'Mechatronics Engineering',
  'Robotics & Automation Engineering',
  'Biotechnology',
  'Biomedical Engineering',
  'Environmental Engineering',
  'Textile Technology',
  'Construction Technology',
  'Mining Engineering',
  'Polymer Science & Engineering',
  'Printing Technology',
];

export const KCET_CATEGORIES = ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B'];

// The imported KEA cutoff files carry explicit R (rural) and K (Kannada
// medium) categories. Other horizontal reservations are not represented.
export const KCET_HORIZONTAL_RESERVATIONS = ['Rural Quota', 'Kannada Medium'];

export const COMEDK_COURSES = [
  'Computer Science & IT',
  'Artificial Intelligence & Data Science',
  'Cyber Security / Emerging Technologies',
  'Electronics & Communication',
  'Electrical',
  'Mechanical / Manufacturing / Automation',
  'Civil / Construction / Infrastructure',
  'Aerospace / Automobile / Marine',
  'Chemical / Materials',
  'Biotechnology / Biomedical',
  'Agriculture',
  'Textile',
  'Design / Planning',
];

/** Seat type present in the currently imported verified COMEDK source. */
export const COMEDK_SEAT_TYPES = ['GM', 'KKR'];

export const NEET_COURSES = [
  'MBBS', 'BDS', 'BAMS', 'BUMS', 'BHMS', 'BNYS', 'B.V.Sc & A.H',
  'B.Pharm', 'Pharma-D', 'B.Sc Nursing', 'Allied Health Sciences', 'Physiotherapy',
];

export const NEET_CATEGORIES = ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'EWS'];

export const JEE_CATEGORIES = ['GM', 'OBC', 'SC', 'ST', 'EWS'];

export const NEET_SPECIAL_RESERVATIONS = [
  'PwD', 'Defence / Ex-Defence', 'NCC', 'Sports', 'Rural', 'Kannada Medium', 'Kalyana Karnataka',
];

export const COLLEGE_TYPES = ['Government', 'Private', 'Autonomous', 'Deemed'];

export const PROBABILITY_COLORS: Record<string, string> = {
  'Very High': '#1B7A3D',
  High: '#2E7D46',
  Medium: '#B8860B',
  Low: '#C0622A',
  'Very Low': '#B3261E',
};
