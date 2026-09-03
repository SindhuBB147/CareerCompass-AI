import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CollegeRepository } from '../repositories/college.repository';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';
import { CollegeDocument, Course, PlacementEntry, StudentReview, SUPPORTED_STATES } from '../models/college.model';
import {
  CollegeAlreadyExistsException, CollegeNotFoundException,
  CourseAlreadyExistsException, CourseNotFoundException,
  InvalidPlacementYearException, PlacementYearAlreadyExistsException,
  PlacementYearNotFoundException, SomeCollegesNotFoundException,
  UnsupportedStateException, UnknownExamCodeException,
} from '../colleges.exceptions';
import {
  CompareCollegesDto, CreateCollegeDto, CreateCourseDto, CreatePlacementDto, CreateReviewDto,
  SearchCollegesDto, UpdateCollegeDto, UpdateCourseDto, UpdatePlacementDto,
  KARNATAKA_EXAMS,
} from '../dto/college.dto';
import { isYearInPast } from '../../../common/utils/date.util';

@Injectable()
export class CollegeService implements OnModuleInit {
  constructor(private readonly repo: CollegeRepository, private readonly events: EventEmitter2) {}

  async onModuleInit() {
    await this.seedInitialCollegesIfEmpty();
  }

  // ── Search & Detail ────────────────────────────────────────────────────────
  async search(dto: SearchCollegesDto) {
    const { results, totalResults } = await this.repo.search(dto);
    return {
      results,
      page: dto.page,
      totalPages: Math.max(1, Math.ceil(totalResults / dto.limit)),
      totalResults,
    };
  }

  async getDetail(idOrSlug: string): Promise<CollegeDocument> {
    const c = await this.repo.findById(idOrSlug);
    if (!c) throw new CollegeNotFoundException();
    return c;
  }

  getFacets(examCode?: string) {
    return this.repo.getFacets(examCode);
  }

  async compare(dto: CompareCollegesDto): Promise<CollegeDocument[]> {
    const colleges = await this.repo.findByIds(dto.collegeIds);
    if (colleges.length < dto.collegeIds.length) {
      const found = new Set(colleges.map(c => c.id || c.slug));
      throw new SomeCollegesNotFoundException(dto.collegeIds.filter(id => !found.has(id)));
    }
    return colleges;
  }

  async addReview(collegeId: string, dto: CreateReviewDto): Promise<StudentReview> {
    const college = await this.repo.findById(collegeId);
    if (!college) throw new CollegeNotFoundException();

    const review: StudentReview = {
      id: 'rev_' + Date.now(),
      userName: dto.userName,
      userRole: 'Student (2025 Batch)',
      rating: dto.rating,
      academicsRating: dto.academicsRating ?? dto.rating,
      placementRating: dto.placementRating ?? dto.rating,
      campusRating: dto.campusRating ?? dto.rating,
      hostelRating: dto.hostelRating ?? dto.rating,
      facultyRating: dto.facultyRating ?? dto.rating,
      comment: dto.comment,
      date: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      verifiedStudent: true,
    };

    await this.repo.addReview(college.id, review);
    return review;
  }

  // ── College Admin CRUD ──────────────────────────────────────────────────────
  async create(dto: CreateCollegeDto, adminId: string, ip?: string): Promise<CollegeDocument> {
    if (dto.state) this.assertKarnataka(dto.state);
    if (await this.repo.findByNameAndState(dto.name, dto.state || 'Karnataka')) throw new CollegeAlreadyExistsException();
    const created = await this.repo.create(dto as unknown as Partial<import('../models/college.model').College>);
    await this.repo.recordAudit({ adminId, action: 'college.create', targetCollection: 'colleges', targetId: created.id, afterSnapshot: dto as any, ipAddress: ip });
    return created;
  }

  async update(id: string, dto: UpdateCollegeDto, adminId: string, ip?: string): Promise<CollegeDocument> {
    if (dto.state) this.assertKarnataka(dto.state);
    const before = await this.repo.findById(id);
    if (!before) throw new CollegeNotFoundException();
    const updated = await this.repo.update(before.id, dto as unknown as Partial<import('../models/college.model').College>);
    if (!updated) throw new CollegeNotFoundException();
    await this.repo.recordAudit({ adminId, action: 'college.update', targetCollection: 'colleges', targetId: id, afterSnapshot: dto as any, ipAddress: ip });
    if (dto.accreditation?.nirfRank !== undefined && dto.accreditation.nirfRank !== before.accreditation?.nirfRank) {
      this.events.emit(NOTIFICATION_EVENTS.COLLEGE_UPDATED, {
        collegeId: updated.id, collegeName: updated.name, subtype: 'nirf_changed',
        summary: `${updated.name}'s NIRF ranking is now #${dto.accreditation.nirfRank}.`,
      });
    }
    return updated;
  }

  async delete(id: string, adminId: string, ip?: string): Promise<void> {
    const college = await this.repo.findById(id);
    if (!college) throw new CollegeNotFoundException();
    await this.repo.delete(college.id);
    await this.repo.recordAudit({ adminId, action: 'college.delete', targetCollection: 'colleges', targetId: college.id, ipAddress: ip });
  }

  // ── Branch (course) ─────────────────────────────────────────────────────────
  async addCourse(collegeId: string, dto: CreateCourseDto): Promise<Course> {
    const courseId = dto.courseId.toUpperCase();
    const exams = dto.examsAccepted.map(e => e.toUpperCase());
    const course: Course = {
      courseId,
      name: dto.name,
      degreeType: dto.degreeType,
      durationYears: 4,
      intake: dto.intake,
      discipline: dto.discipline ?? 'Engineering',
      examsAccepted: exams,
      feePerYear: dto.feePerYear ?? null,
      eligibility: '10+2 with Physics, Mathematics & Chemistry/CS (Min 45%)',
      cutoffRankSummary: null,
    };
    const updated = await this.repo.addCourseIfNotExists(collegeId, course);
    if (updated) {
      this.events.emit(NOTIFICATION_EVENTS.COLLEGE_UPDATED, {
        collegeId: updated.id, collegeName: updated.name, subtype: 'course_added',
        summary: `${updated.name} added a new course: ${course.name}.`,
      });
      return course;
    }
    if (!(await this.repo.exists(collegeId))) throw new CollegeNotFoundException();
    throw new CourseAlreadyExistsException();
  }

  async updateCourse(collegeId: string, courseId: string, dto: UpdateCourseDto): Promise<Course> {
    const normId = courseId.toUpperCase();
    const doc = await this.repo.findCourse(collegeId, normId);
    if (!doc) throw new CourseNotFoundException();
    const updated = await this.repo.updateCourse(collegeId, normId, dto);
    if (!updated) throw new CourseNotFoundException();
    const course = updated.courses.find(c => c.courseId === normId);
    if (!course) throw new CourseNotFoundException();
    return course;
  }

  async removeCourse(collegeId: string, courseId: string): Promise<void> {
    const normId = courseId.toUpperCase();
    const doc = await this.repo.findCourse(collegeId, normId);
    if (!doc) throw new CourseNotFoundException();
    await this.repo.removeCourse(collegeId, normId);
  }

  async updateCourseFee(collegeId: string, courseId: string, feePerYear: number): Promise<Course> {
    const normId = courseId.toUpperCase();
    const updated = await this.repo.updateCourseFee(collegeId, normId, feePerYear);
    if (!updated) throw new CourseNotFoundException();
    const course = updated.courses.find(c => c.courseId === normId);
    if (!course) throw new CourseNotFoundException();
    this.events.emit(NOTIFICATION_EVENTS.COLLEGE_UPDATED, {
      collegeId: updated.id, collegeName: updated.name, subtype: 'fee_changed',
      summary: `${course.name} at ${updated.name} now costs ₹${feePerYear.toLocaleString('en-IN')}/year.`,
    });
    return course;
  }

  // ── Placement ───────────────────────────────────────────────────────────────
  async addPlacement(collegeId: string, dto: CreatePlacementDto): Promise<PlacementEntry> {
    const entry: PlacementEntry = {
      year: dto.year,
      highestPackage: dto.highestPackage,
      averagePackage: dto.averagePackage,
      medianPackage: dto.medianPackage,
      placementPercentage: dto.placementPercentage,
      topRecruiters: dto.topRecruiters ?? [],
    };
    const updated = await this.repo.addPlacementIfNotExists(collegeId, entry);
    if (updated) {
      this.events.emit(NOTIFICATION_EVENTS.COLLEGE_UPDATED, {
        collegeId: updated.id, collegeName: updated.name, subtype: 'placement_updated',
        summary: `${updated.name} published ${dto.year} placement data — ${dto.placementPercentage}% placed.`,
      });
      return entry;
    }
    if (!(await this.repo.exists(collegeId))) throw new CollegeNotFoundException();
    throw new PlacementYearAlreadyExistsException(dto.year);
  }

  async updatePlacement(collegeId: string, year: number, dto: UpdatePlacementDto): Promise<PlacementEntry> {
    const doc = await this.repo.findPlacementByYear(collegeId, year);
    if (!doc) throw new PlacementYearNotFoundException(year);
    const updated = await this.repo.updatePlacement(collegeId, year, dto);
    if (!updated) throw new PlacementYearNotFoundException(year);
    const entry = updated.placementSummary.find(e => e.year === year);
    if (!entry) throw new PlacementYearNotFoundException(year);
    return entry;
  }

  private assertKarnataka(state: string) {
    if (!(SUPPORTED_STATES as readonly string[]).includes(state as any)) throw new UnsupportedStateException(state);
  }

  // ── Initial Seed Data ───────────────────────────────────────────────────────
  private async seedInitialCollegesIfEmpty() {
    try {
      const { totalResults } = await this.repo.search({ page: 1, limit: 1 });
      if (totalResults > 0) return;

      const mockColleges = [
        {
          name: 'RV College of Engineering',
          slug: 'rvce',
          aliasNames: ['RVCE', 'RV College'],
          state: 'Karnataka',
          city: 'Bengaluru',
          collegeType: 'Autonomous' as const,
          establishedYear: 1963,
          aicteApproved: true,
          rating: 4.9,
          reviewsCount: 342,
          campusSizeAcres: 52,
          studentCount: 6800,
          facultyCount: 410,
          bannerImage: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'R.V. College of Engineering (RVCE) established in 1963 is one of the premier self-financing engineering institutions in India. Situated on Mysore Road in Bengaluru, RVCE offers 15 undergraduate engineering programs and 14 postgraduate programs with state-of-the-art research centers.',
          highlights: ['NIRF #89 Ranked Engineering College in India', 'NAAC A++ Grade Accreditation with 3.65 CGPA', 'Highest Package ₹52.0 LPA (Microsoft)', '98.4% Placement Record in 2024'],
          accreditation: { naac: 'A++', nbaCourses: ['CSE', 'ISE', 'ECE', 'EEE', 'Mechanical'], nirfRank: 89 },
          contact: { website: 'https://rvce.edu.in', email: 'principal@rvce.edu.in', phone: '+91 80 6818 8100', address: 'RV Vidyaniketan Post, Mysuru Road, Bengaluru - 560059' },
          feeBreakdown: { tuitionFee: 240000, hostelFee: 110000, messFee: 45000, otherCharges: 15000, totalAnnualFee: 410000 },
          hostelInfo: {
            boysHostel: true, girlsHostel: true, capacity: 2400,
            roomTypes: ['Single Deluxe', 'Double Sharing AC', 'Triple Sharing Non-AC'],
            messDetails: 'Nutritious South & North Indian multi-cuisine mess serving 4 times daily.',
            amenities: ['High-speed 1Gbps WiFi', 'Biometric Security', 'Gymnasium', 'Basketball Court', 'Laundry Services', '24x7 Ambulance & Medical Center'],
            images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80']
          },
          gallery: [
            { category: 'Campus' as const, url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80', title: 'Main Academic Block' },
            { category: 'Library' as const, url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80', title: 'Central Digital Library' },
            { category: 'Labs' as const, url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80', title: 'AI & High Performance Computing Lab' },
          ],
          courses: [
            { courseId: 'CSE', name: 'Computer Science & Engineering', degreeType: 'B.E.', durationYears: 4, intake: 240, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 240000, eligibility: '10+2 with Min 45% in PCM', cutoffRankSummary: 380 },
            { courseId: 'ISE', name: 'Information Science & Engineering', degreeType: 'B.E.', durationYears: 4, intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 240000, eligibility: '10+2 with Min 45% in PCM', cutoffRankSummary: 620 },
            { courseId: 'ECE', name: 'Electronics & Communication Engineering', degreeType: 'B.E.', durationYears: 4, intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 240000, eligibility: '10+2 with Min 45% in PCM', cutoffRankSummary: 1150 },
          ],
          placementSummary: [
            { year: 2024, highestPackage: 52.0, averagePackage: 15.4, medianPackage: 12.8, placementPercentage: 98.4, topRecruiters: ['Microsoft', 'Amazon', 'Cisco', 'Texas Instruments', 'Intel', 'Atlassian', 'Goldman Sachs'] }
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'Check Eligibility Criteria', description: 'Candidates must pass 10+2 with Physics and Mathematics as compulsory subjects alongside Chemistry/Biotechnology/CS with minimum 45% aggregate.' },
            { stepNumber: 2, title: 'Appear for Entrance Exams', description: 'Register and appear for KCET (Karnataka CET) or COMEDK UGET entrance examinations.' },
            { stepNumber: 3, title: 'KEA Option Entry & Counseling', description: 'Participate in KEA online option entry rounds and select RV College of Engineering as top preference.' },
            { stepNumber: 4, title: 'Seat Allotment & Document Verification', description: 'Upon seat allotment, report to KEA document verification centers with original mark sheets and certificates.' },
            { stepNumber: 5, title: 'College Reporting & Final Admission', description: 'Report to RVCE campus, submit verified documents, pay institutional fees, and collect student ID card.' },
          ],
          reviewsList: [
            { id: 'r1', userName: 'Ananya Rao', userRole: 'CSE Student (Batch 2025)', rating: 5, academicsRating: 5, placementRating: 5, campusRating: 4.8, hostelRating: 4.5, facultyRating: 4.9, comment: 'Exceptional placement opportunities! Almost all top tech giants visit campus. Coding culture is unmatched.', date: 'Jan 2025', verifiedStudent: true },
            { id: 'r2', userName: 'Karthik Gowda', userRole: 'ECE Graduate', rating: 4.8, academicsRating: 4.8, placementRating: 5, campusRating: 4.6, hostelRating: 4.2, facultyRating: 4.7, comment: 'Rigorous academics with top notch VLSI and Embedded Systems research labs. Highly recommend for core electronics.', date: 'Dec 2024', verifiedStudent: true }
          ]
        },
        {
          name: 'BMS College of Engineering',
          slug: 'bmsce',
          aliasNames: ['BMSCE', 'BMS College'],
          state: 'Karnataka',
          city: 'Bengaluru',
          collegeType: 'Autonomous' as const,
          establishedYear: 1946,
          aicteApproved: true,
          rating: 4.8,
          reviewsCount: 290,
          campusSizeAcres: 15,
          studentCount: 5200,
          facultyCount: 380,
          bannerImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'B.M.S. College of Engineering (BMSCE) was founded in 1946 by Late Sri B. M. Sreenivasaiah and is the first private engineering college in India. Located in the heart of Bengaluru city at Basavanagudi, it is renowned for heritage academic excellence.',
          highlights: ['NIRF #101 Ranked Engineering Institution', 'NAAC A++ Grade Accreditation', 'Highest Package ₹50.0 LPA', '95.2% Overall Placement Percentage'],
          accreditation: { naac: 'A++', nbaCourses: ['CSE', 'ISE', 'ECE', 'Mechanical', 'Civil'], nirfRank: 101 },
          contact: { website: 'https://bmsce.ac.in', email: 'principal@bmsce.ac.in', phone: '+91 80 2662 2130', address: 'Bull Temple Road, Basavanagudi, Bengaluru - 560019' },
          feeBreakdown: { tuitionFee: 220000, hostelFee: 105000, messFee: 42000, otherCharges: 12000, totalAnnualFee: 379000 },
          hostelInfo: {
            boysHostel: true, girlsHostel: true, capacity: 1800,
            roomTypes: ['Single Occupancy', 'Double Sharing', 'Four Sharing'],
            messDetails: 'High-quality South Indian and North Indian dining facilities.',
            amenities: ['24x7 WiFi', 'Gymnasium', 'Library Annex', 'Sports Ground', 'Security CCTV'],
            images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80']
          },
          gallery: [
            { category: 'Campus' as const, url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80', title: 'Heritage Campus Building' }
          ],
          courses: [
            { courseId: 'CSE', name: 'Computer Science & Engineering', degreeType: 'B.E.', durationYears: 4, intake: 240, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 220000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 750 },
            { courseId: 'ISE', name: 'Information Science & Engineering', degreeType: 'B.E.', durationYears: 4, intake: 180, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 220000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 1120 },
            { courseId: 'MECH', name: 'Mechanical Engineering', degreeType: 'B.E.', durationYears: 4, intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 200000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 8500 },
            { courseId: 'CIVIL', name: 'Civil Engineering', degreeType: 'B.E.', durationYears: 4, intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 195000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 12500 }
          ],
          placementSummary: [
            { year: 2024, highestPackage: 50.0, averagePackage: 11.8, medianPackage: 8.8, placementPercentage: 95.2, topRecruiters: ['Amazon', 'Cisco', 'TCS', 'Infosys', 'Wipro', 'Bosch', 'Oracle'] }
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'Eligibility Check', description: 'Must have passed 10+2 with 45% aggregate in Physics, Mathematics and Chemistry.' },
            { stepNumber: 2, title: 'KCET / COMEDK Rank', description: 'Securing merit rank in KEA KCET or COMEDK UGET counseling.' }
          ],
          reviewsList: [
            { id: 'r3', userName: 'Priya N', userRole: 'ISE Student', rating: 4.7, academicsRating: 4.8, placementRating: 4.8, campusRating: 4.5, hostelRating: 4.2, facultyRating: 4.7, comment: 'Great location in Central Bengaluru and very strong alumni network across Silicon Valley.', date: 'Feb 2025', verifiedStudent: true }
          ]
        },
        {
          name: 'Ramaiah Institute of Technology',
          slug: 'msrit',
          aliasNames: ['MSRIT', 'MS Ramaiah'],
          state: 'Karnataka',
          city: 'Bengaluru',
          collegeType: 'Autonomous' as const,
          establishedYear: 1962,
          aicteApproved: true,
          rating: 4.8,
          reviewsCount: 310,
          campusSizeAcres: 27,
          studentCount: 6100,
          facultyCount: 395,
          bannerImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'M. S. Ramaiah Institute of Technology (MSRIT) was started in 1962 by the late Dr. M.S. Ramaiah. MSRIT is part of Gokula Education Foundation and is recognized as one of the premier autonomous engineering hubs in South India.',
          highlights: ['NIRF #78 Ranked Engineering Institute in India', 'NAAC A+ Grade Accredited', 'Highest Package ₹50.0 LPA', '96.8% Placement Record'],
          accreditation: { naac: 'A+', nbaCourses: ['CSE', 'ISE', 'ECE', 'AI&DS'], nirfRank: 78 },
          contact: { website: 'https://msrit.edu', email: 'principal@msrit.edu', phone: '+91 80 2360 0822', address: 'MSR Nagar, MSRIT Post, Mathikere, Bengaluru - 560054' },
          feeBreakdown: { tuitionFee: 230000, hostelFee: 115000, messFee: 44000, otherCharges: 14000, totalAnnualFee: 403000 },
          hostelInfo: {
            boysHostel: true, girlsHostel: true, capacity: 2200,
            roomTypes: ['Single', 'Double Sharing AC', 'Triple Sharing'],
            messDetails: 'Multi-cuisine mess with hygiene certifications.',
            amenities: ['WiFi 500Mbps', 'Sports Complex', 'Medical Hospital Annex', 'Power Backup'],
            images: []
          },
          gallery: [],
          courses: [
            { courseId: 'CSE', name: 'Computer Science & Engineering', degreeType: 'B.E.', durationYears: 4, intake: 240, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 230000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 920 },
            { courseId: 'AIDS', name: 'Artificial Intelligence & Data Science', degreeType: 'B.E.', durationYears: 4, intake: 120, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 230000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 1240 },
            { courseId: 'EEE', name: 'Electrical & Electronics Engineering', degreeType: 'B.E.', durationYears: 4, intake: 90, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 220000, eligibility: '10+2 PCM 45%', cutoffRankSummary: 9800 }
          ],
          placementSummary: [
            { year: 2024, highestPackage: 50.0, averagePackage: 12.2, medianPackage: 9.2, placementPercentage: 96.8, topRecruiters: ['Amazon', 'Adobe', 'Samsung', 'Akamai', 'Capgemini'] }
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'Karnataka CET Option Entry', description: 'Select MSRIT during KEA seat matrix allocation rounds.' }
          ],
          reviewsList: [
            { id: 'r4', userName: 'Varun Kumar', userRole: 'AI&DS Student', rating: 4.8, academicsRating: 4.8, placementRating: 4.9, campusRating: 4.7, hostelRating: 4.4, facultyRating: 4.8, comment: 'Amazing infrastructure and dedicated innovation labs for AI & Machine Learning.', date: 'Jan 2025', verifiedStudent: true }
          ]
        },
        {
          name: 'PES University (RR Campus)',
          slug: 'pesu',
          aliasNames: ['PESU', 'PES Institute'],
          state: 'Karnataka',
          city: 'Bengaluru',
          collegeType: 'Deemed' as const,
          establishedYear: 1972,
          aicteApproved: true,
          rating: 4.7,
          reviewsCount: 260,
          campusSizeAcres: 30,
          studentCount: 8200,
          facultyCount: 520,
          bannerImage: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'PES University, located in Bengaluru, India is one of the country’s leading teaching and research universities. Committed to providing education for the real world.',
          highlights: ['NIRF #105 Ranked University', 'Highest Package ₹65.0 LPA (Atlassian)', 'PESSAT / KCET Exam Accepted'],
          accreditation: { naac: 'A', nbaCourses: ['CSE', 'ECE'], nirfRank: 105 },
          contact: { website: 'https://pes.edu', email: 'admissions@pes.edu', phone: '+91 80 2672 1983', address: '100 Feet Ring Road, BSK III Stage, Bengaluru - 560085' },
          feeBreakdown: { tuitionFee: 360000, hostelFee: 130000, messFee: 50000, otherCharges: 20000, totalAnnualFee: 560000 },
          hostelInfo: {
            boysHostel: true, girlsHostel: true, capacity: 3000,
            roomTypes: ['Double AC', 'Triple Non-AC'],
            messDetails: 'High quality vegetarian and non-vegetarian food courts.',
            amenities: ['High Speed Internet', 'Indoor Stadium', '24/7 Security'],
            images: []
          },
          gallery: [],
          courses: [
            { courseId: 'CSE', name: 'Computer Science & Engineering', degreeType: 'B.Tech', durationYears: 4, intake: 720, examsAccepted: ['KCET', 'PESSAT'], feePerYear: 360000, eligibility: '10+2 PCM 50%', cutoffRankSummary: 1100 }
          ],
          placementSummary: [
            { year: 2024, highestPackage: 65.0, averagePackage: 14.5, medianPackage: 10.5, placementPercentage: 97.5, topRecruiters: ['Atlassian', 'Microsoft', 'Intuit', 'Cisco'] }
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'PESSAT / KCET Entrance', description: 'Take PESSAT or KCET for seat selection.' }
          ],
          reviewsList: []
        },
        // ── Non-engineering disciplines (Admission Probability Predictor) ──
        // Real Karnataka institutions, deliberately leaner records than the
        // engineering colleges above — enough for the predictor to return
        // genuine, differentiated results for every KCET discipline, COMEDK
        // grouping, and NEET course. `accreditation.nirfRank` is left unset
        // where a confident real figure isn't known — the predictor sorts
        // unranked colleges after ranked ones rather than fabricating a number.
        {
          name: 'Bangalore Medical College and Research Institute',
          slug: 'bmcri',
          aliasNames: ['BMCRI'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Government' as const,
          establishedYear: 1955, aicteApproved: true, rating: 4.6, reviewsCount: 140,
          campusSizeAcres: 25, studentCount: 1500, facultyCount: 260,
          bannerImage: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'Bangalore Medical College and Research Institute (BMCRI) is a premier government medical college affiliated to Rajiv Gandhi University of Health Sciences, offering MBBS and postgraduate medical programs with attached teaching hospitals.',
          highlights: ['Government Medical College', 'Attached Victoria & Bowring Hospitals', 'NEET UG Admission'],
          accreditation: { naac: 'A', nbaCourses: [] },
          contact: { website: 'https://bmcri.org', address: 'Fort, K.R. Market, Bengaluru - 560002' },
          feeBreakdown: { tuitionFee: 12000, hostelFee: 18000, messFee: 24000, otherCharges: 6000, totalAnnualFee: 60000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 900, roomTypes: ['Double Sharing'], messDetails: 'Government mess facility, subsidized rates.', amenities: ['WiFi', '24/7 Security', 'Medical Room'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'MBBS', name: 'Bachelor of Medicine, Bachelor of Surgery', degreeType: 'MBBS', durationYears: 5, intake: 250, examsAccepted: ['NEET'], feePerYear: 12000, eligibility: 'NEET UG qualified, 10+2 PCB', cutoffRankSummary: 4500, discipline: 'Medical' },
          ],
          placementSummary: [],
          admissionProcess: [
            { stepNumber: 1, title: 'NEET UG', description: 'Qualify NEET UG and register for Karnataka NEET UG counselling (state quota) via KEA.' },
          ],
          reviewsList: [],
        },
        {
          name: 'Government Dental College and Research Institute',
          slug: 'gdcri',
          aliasNames: ['GDCRI'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Government' as const,
          establishedYear: 1959, aicteApproved: true, rating: 4.4, reviewsCount: 65,
          campusSizeAcres: 8, studentCount: 400, facultyCount: 90,
          bannerImage: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'Government Dental College and Research Institute, Bengaluru is a state government dental college offering BDS and postgraduate dental programs.',
          highlights: ['Government Dental College', 'NEET UG Admission'],
          accreditation: { naac: 'A', nbaCourses: [] },
          contact: { address: 'Fort, K.R. Market, Bengaluru - 560002' },
          feeBreakdown: { tuitionFee: 12000, hostelFee: 16000, messFee: 22000, otherCharges: 5000, totalAnnualFee: 55000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 300, roomTypes: ['Double Sharing'], messDetails: 'Government mess facility.', amenities: ['WiFi', '24/7 Security'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BDS', name: 'Bachelor of Dental Surgery', degreeType: 'BDS', durationYears: 5, intake: 60, examsAccepted: ['NEET'], feePerYear: 12000, eligibility: 'NEET UG qualified, 10+2 PCB', cutoffRankSummary: 18000, discipline: 'Dental' },
          ],
          placementSummary: [],
          admissionProcess: [
            { stepNumber: 1, title: 'NEET UG', description: 'Qualify NEET UG and register for Karnataka NEET UG counselling (state quota) via KEA.' },
          ],
          reviewsList: [],
        },
        {
          name: 'Government Naturopathy Medical College',
          slug: 'gnmc-bengaluru',
          aliasNames: ['GNMC'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Government' as const,
          establishedYear: 2004, aicteApproved: true, rating: 4.1, reviewsCount: 22,
          campusSizeAcres: 5, studentCount: 250, facultyCount: 35,
          bannerImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'A government naturopathy and yogic sciences college offering BNYS, admitted through both KCET (KEA) and NEET UG counselling routes.',
          highlights: ['BNYS Programme', 'KCET & NEET Admission Routes'],
          accreditation: { naac: 'B++', nbaCourses: [] },
          contact: { address: 'Bengaluru, Karnataka' },
          feeBreakdown: { tuitionFee: 25000, hostelFee: 20000, messFee: 24000, otherCharges: 6000, totalAnnualFee: 75000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 150, roomTypes: ['Triple Sharing'], messDetails: 'Vegetarian mess.', amenities: ['WiFi', 'Yoga Hall'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BNYS', name: 'Bachelor of Naturopathy and Yogic Sciences', degreeType: 'BNYS', durationYears: 5, intake: 60, examsAccepted: ['KCET', 'NEET'], feePerYear: 25000, eligibility: 'KCET/NEET qualified, 10+2 PCB', cutoffRankSummary: 22000, discipline: 'Naturopathy' },
          ],
          placementSummary: [],
          admissionProcess: [
            { stepNumber: 1, title: 'KCET / NEET Option Entry', description: 'Select BNYS discipline during KCET KEA counselling, or via NEET UG state quota counselling.' },
          ],
          reviewsList: [],
        },
        {
          name: 'BMS College of Architecture',
          slug: 'bmsca',
          aliasNames: ['BMSCA'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Autonomous' as const,
          establishedYear: 1957, aicteApproved: true, rating: 4.5, reviewsCount: 88,
          campusSizeAcres: 6, studentCount: 600, facultyCount: 55,
          bannerImage: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'BMS College of Architecture, Bengaluru offers a NATA/KCET-admitted Bachelor of Architecture programme with a strong design studio culture.',
          highlights: ['Council of Architecture Approved', 'NATA / KCET Admission'],
          accreditation: { naac: 'A', nbaCourses: [] },
          contact: { website: 'https://bmsca.org', address: 'Basavanagudi, Bengaluru - 560019' },
          feeBreakdown: { tuitionFee: 150000, hostelFee: 90000, messFee: 40000, otherCharges: 10000, totalAnnualFee: 290000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 200, roomTypes: ['Double Sharing'], messDetails: 'Multi-cuisine mess.', amenities: ['WiFi', 'Design Studios'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BARCH', name: 'Bachelor of Architecture', degreeType: 'B.Arch', durationYears: 5, intake: 80, examsAccepted: ['KCET'], feePerYear: 150000, eligibility: 'NATA score + 10+2 with Mathematics', cutoffRankSummary: 9500, discipline: 'Architecture' },
          ],
          placementSummary: [
            { year: 2024, highestPackage: 12.0, averagePackage: 6.5, medianPackage: 5.8, placementPercentage: 78, topRecruiters: ['RSP Design', 'Hafeez Contractor', 'Local studios'] },
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'NATA + KCET Option Entry', description: 'Qualify NATA, then select NATA (Architecture) discipline during KCET KEA counselling.' },
          ],
          reviewsList: [],
        },
        {
          name: 'University of Agricultural Sciences, Bengaluru (GKVK)',
          slug: 'uas-bengaluru',
          aliasNames: ['UAS Bengaluru', 'GKVK'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Government' as const,
          establishedYear: 1964, aicteApproved: false, rating: 4.4, reviewsCount: 54,
          campusSizeAcres: 1300, studentCount: 2200, facultyCount: 210,
          bannerImage: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'The University of Agricultural Sciences, Bengaluru (GKVK campus) offers a B.Sc (Hons) Agriculture programme admitted through KCET and COMEDK.',
          highlights: ['ICAR-affiliated Agricultural University', 'KCET & COMEDK Admission'],
          accreditation: { naac: 'A', nbaCourses: [] },
          contact: { website: 'https://uasbangalore.edu.in', address: 'GKVK Campus, Bengaluru - 560065' },
          feeBreakdown: { tuitionFee: 35000, hostelFee: 22000, messFee: 26000, otherCharges: 7000, totalAnnualFee: 90000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 800, roomTypes: ['Double Sharing', 'Triple Sharing'], messDetails: 'Multi-cuisine mess.', amenities: ['WiFi', 'Farm Labs', 'Sports Ground'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BSCAG', name: 'B.Sc (Hons) Agriculture', degreeType: 'B.Sc Agriculture', durationYears: 4, intake: 200, examsAccepted: ['KCET', 'COMEDK'], feePerYear: 35000, eligibility: '10+2 PCM/PCB, min 45%', cutoffRankSummary: 15000, discipline: 'Agriculture' },
          ],
          placementSummary: [
            { year: 2024, highestPackage: 9.0, averagePackage: 5.2, medianPackage: 4.8, placementPercentage: 70, topRecruiters: ['ITC', 'UPL', 'Bayer CropScience'] },
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'KCET / COMEDK Option Entry', description: 'Select Agriculture B.Sc discipline (KCET) or Agriculture grouping (COMEDK) during counselling.' },
          ],
          reviewsList: [],
        },
        {
          name: 'Veterinary College, Bengaluru (KVAFSU)',
          slug: 'veterinary-college-bengaluru',
          aliasNames: ['KVAFSU Bengaluru', 'Vet College Hebbal'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Government' as const,
          establishedYear: 1962, aicteApproved: false, rating: 4.3, reviewsCount: 40,
          campusSizeAcres: 100, studentCount: 500, facultyCount: 90,
          bannerImage: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'Veterinary College, Hebbal, Bengaluru, under Karnataka Veterinary, Animal and Fisheries Sciences University, offers B.V.Sc & A.H admitted via KCET and NEET.',
          highlights: ['KVAFSU Constituent College', 'KCET & NEET Admission'],
          accreditation: { naac: 'A', nbaCourses: [] },
          contact: { website: 'https://kvafsu.edu.in', address: 'Hebbal, Bengaluru - 560024' },
          feeBreakdown: { tuitionFee: 45000, hostelFee: 24000, messFee: 26000, otherCharges: 8000, totalAnnualFee: 103000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 400, roomTypes: ['Double Sharing'], messDetails: 'Multi-cuisine mess.', amenities: ['WiFi', 'Animal Hospital Labs'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BVSC', name: 'Bachelor of Veterinary Science & Animal Husbandry', degreeType: 'B.V.Sc & A.H', durationYears: 5, intake: 100, examsAccepted: ['KCET', 'NEET'], feePerYear: 45000, eligibility: 'KCET/NEET qualified, 10+2 PCB', cutoffRankSummary: 12000, discipline: 'Veterinary' },
          ],
          placementSummary: [
            { year: 2024, highestPackage: 8.5, averagePackage: 5.5, medianPackage: 5.0, placementPercentage: 82, topRecruiters: ['Government Veterinary Services', 'Zoetis', 'Dairy Cooperatives'] },
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'KCET / NEET Option Entry', description: 'Select Veterinary Science discipline during KCET KEA counselling, or via NEET UG state quota.' },
          ],
          reviewsList: [],
        },
        {
          name: 'Al-Ameen College of Pharmacy',
          slug: 'al-ameen-pharmacy',
          aliasNames: ['Al-Ameen Pharmacy'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Private' as const,
          establishedYear: 1982, aicteApproved: true, rating: 4.2, reviewsCount: 76,
          campusSizeAcres: 4, studentCount: 700, facultyCount: 65,
          bannerImage: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'Al-Ameen College of Pharmacy, Bengaluru offers B.Pharm and Pharm.D programmes admitted through KCET and NEET routes, affiliated to RGUHS.',
          highlights: ['PCI Approved', 'B.Pharm & Pharma-D Programmes', 'KCET & NEET Admission'],
          accreditation: { naac: 'A', nbaCourses: [] },
          contact: { website: 'https://alameenpharmacy.edu.in', address: 'Hosur Road, Bengaluru - 560027' },
          feeBreakdown: { tuitionFee: 90000, hostelFee: 45000, messFee: 28000, otherCharges: 8000, totalAnnualFee: 171000 },
          hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 300, roomTypes: ['Double Sharing', 'Triple Sharing'], messDetails: 'Multi-cuisine mess.', amenities: ['WiFi', 'Pharmacy Labs'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BPHARM', name: 'Bachelor of Pharmacy', degreeType: 'B.Pharm', durationYears: 4, intake: 100, examsAccepted: ['KCET', 'NEET'], feePerYear: 90000, eligibility: '10+2 PCM/PCB, min 45%', cutoffRankSummary: 28000, discipline: 'Pharmacy' },
            { courseId: 'PHARMD', name: 'Doctor of Pharmacy', degreeType: 'Pharma-D', durationYears: 6, intake: 30, examsAccepted: ['KCET', 'NEET'], feePerYear: 110000, eligibility: '10+2 PCB, min 45%', cutoffRankSummary: 32000, discipline: 'Pharmacy' },
          ],
          placementSummary: [
            { year: 2024, highestPackage: 7.5, averagePackage: 4.2, medianPackage: 3.8, placementPercentage: 75, topRecruiters: ['Cipla', 'Biocon', 'Dr. Reddy\'s', 'Apollo Pharmacy'] },
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'KCET / NEET Option Entry', description: 'Select B-Pharma / Pharma-D discipline during KCET KEA counselling, or via NEET UG counselling.' },
          ],
          reviewsList: [],
        },
        {
          name: 'RajaRajeswari College of Nursing',
          slug: 'rr-nursing',
          aliasNames: ['RRCN'],
          state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
          collegeType: 'Private' as const,
          establishedYear: 2001, aicteApproved: false, rating: 4.0, reviewsCount: 48,
          campusSizeAcres: 5, studentCount: 500, facultyCount: 55,
          bannerImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
          logo: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=160&q=80',
          description: 'RajaRajeswari College of Nursing, Bengaluru offers a B.Sc Nursing programme admitted through KCET and NEET, affiliated to RGUHS and INC-approved.',
          highlights: ['INC Approved', 'Attached Teaching Hospital', 'KCET & NEET Admission'],
          accreditation: { naac: 'B++', nbaCourses: [] },
          contact: { website: 'https://rrcn.edu.in', address: 'Kambipura, Bengaluru - 560074' },
          feeBreakdown: { tuitionFee: 80000, hostelFee: 40000, messFee: 26000, otherCharges: 8000, totalAnnualFee: 154000 },
          hostelInfo: { boysHostel: false, girlsHostel: true, capacity: 250, roomTypes: ['Triple Sharing'], messDetails: 'Vegetarian & non-vegetarian mess.', amenities: ['WiFi', 'Skills Lab'], images: [] },
          gallery: [],
          courses: [
            { courseId: 'BSCN', name: 'Bachelor of Science in Nursing', degreeType: 'B.Sc Nursing', durationYears: 4, intake: 100, examsAccepted: ['KCET', 'NEET'], feePerYear: 80000, eligibility: '10+2 PCB, min 45%', cutoffRankSummary: 35000, discipline: 'Nursing' },
          ],
          placementSummary: [
            { year: 2024, highestPackage: 6.0, averagePackage: 3.8, medianPackage: 3.5, placementPercentage: 80, topRecruiters: ['Manipal Hospitals', 'Fortis', 'Apollo Hospitals'] },
          ],
          admissionProcess: [
            { stepNumber: 1, title: 'KCET / NEET Option Entry', description: 'Select B.Sc Nursing discipline during KCET KEA counselling, or via NEET UG counselling.' },
          ],
          reviewsList: [],
        }
      ];

      for (const col of mockColleges) {
        await this.repo.create(col as any);
      }
      console.log('Seeded initial Karnataka colleges into MongoDB successfully.');
    } catch (e) {
      // Ignore seed error if DB is unreachable in offline mode
    }
  }
}
