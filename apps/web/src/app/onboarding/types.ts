export interface Step1Data {
  photoUrl: string;
  fullName: string;
  gender: string;
  dob: string;
  phone: string;
  state: string;
  district: string;
  city: string;
  pinCode: string;
  preferredLanguage: string;
}

export interface Step2Data {
  currentQualification: string;
  tenthPercentage: string;
  twelfthPercentage: string;
  diploma: string;
  pucBoard: string;
  yearOfPassing: string;
  gapYears: string;
}

export interface ExamEntry {
  examCode: string;
  rank: string;
  categoryRank: string;
  percentile: string;
  attemptYear: string;
}

export interface Step3Data {
  exams: ExamEntry[];
}

export interface Step4Data {
  reservationCategory: string;
  horizontalReservations: string[];
}

export interface Step5Data {
  preferredExam: string;
  preferredDiscipline: string;
  preferredCourses: string[];
  preferredColleges: string[];
  preferredCities: string[];
  collegeType: string;
  hostelRequired: boolean;
  budgetMax: string;
  loanRequired: boolean;
  postGraduationPlan: string;
}

export interface Step6Data {
  careerGoal: string;
  dreamCompanies: string[];
  interestAreas: string[];
  skills: string[];
  programmingLanguages: string[];
  learningStyle: string;
  communicationLanguage: string;
  receiveAiSuggestions: boolean;
  receiveNotifications: boolean;
}

export const EXAM_OPTIONS = ['KCET', 'COMEDK', 'NEET', 'JEE_MAIN', 'JEE_ADVANCED', 'OTHER'];
export const EXAM_LABELS: Record<string, string> = {
  KCET: 'KCET', COMEDK: 'COMEDK', NEET: 'NEET', JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Advanced', OTHER: 'Other',
};

export const RESERVATION_CATEGORIES = ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'EWS'];
export const HORIZONTAL_RESERVATIONS = [
  'PwD', 'Rural', 'Kannada Medium', 'Kalyana Karnataka', 'Sports', 'NCC',
  'Defence', 'Ex-Defence', 'CAPF', 'CRPF', 'BSF', 'ITBP', 'Minority',
];
