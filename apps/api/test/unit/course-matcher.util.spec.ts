import {
  KCET_ENGINEERING_COURSE_OPTIONS, COMEDK_COURSE_OPTIONS, NEET_COURSE_OPTIONS,
  courseOptionsForExam, courseMatchesSelection, courseMatchesDiscipline,
  resolveDisciplineOption, allowedCategoriesForExam, KCET_CATEGORIES, NEET_CATEGORIES,
} from '../../src/modules/predictions/utils/course-matcher.util';

describe('course-matcher.util', () => {
  describe('resolveDisciplineOption', () => {
    it('resolves a known KCET discipline label case-insensitively', () => {
      expect(resolveDisciplineOption('Engineering')?.disciplineValue).toBe('Engineering');
      expect(resolveDisciplineOption('b-pharma')?.disciplineValue).toBe('Pharmacy');
      expect(resolveDisciplineOption('NATA (Architecture)')?.disciplineValue).toBe('Architecture');
    });

    it('returns undefined for an unknown label', () => {
      expect(resolveDisciplineOption('Underwater Basket Weaving')).toBeUndefined();
    });
  });

  describe('courseOptionsForExam', () => {
    it('returns the right option set per exam', () => {
      expect(courseOptionsForExam('KCET')).toBe(KCET_ENGINEERING_COURSE_OPTIONS);
      expect(courseOptionsForExam('COMEDK')).toBe(COMEDK_COURSE_OPTIONS);
      expect(courseOptionsForExam('NEET')).toBe(NEET_COURSE_OPTIONS);
    });
  });

  describe('courseMatchesSelection', () => {
    it('matches a DB course name against a KCET alias label via keywords', () => {
      const course = { name: 'Artificial Intelligence & Data Science', degreeType: 'B.E.' };
      const matched = courseMatchesSelection(course, ['Artificial Intelligence & Data Science (AI & DS)'], KCET_ENGINEERING_COURSE_OPTIONS);
      expect(matched).toBe(true);
    });

    it('does not match an unrelated course', () => {
      const course = { name: 'Civil Engineering', degreeType: 'B.E.' };
      const matched = courseMatchesSelection(course, ['Computer Science & Engineering (CSE)'], KCET_ENGINEERING_COURSE_OPTIONS);
      expect(matched).toBe(false);
    });

    it('matches NEET options via degreeType, not just keywords', () => {
      const course = { name: 'Bachelor of Medicine, Bachelor of Surgery', degreeType: 'MBBS' };
      expect(courseMatchesSelection(course, ['MBBS'], NEET_COURSE_OPTIONS)).toBe(true);
    });

    it('matches COMEDK grouped options against a specific DB course', () => {
      const course = { name: 'Mechanical Engineering', degreeType: 'B.E.' };
      expect(courseMatchesSelection(course, ['Mechanical / Manufacturing / Automation'], COMEDK_COURSE_OPTIONS)).toBe(true);
    });

    it('returns false when no labels are selected', () => {
      const course = { name: 'Computer Science & Engineering', degreeType: 'B.E.' };
      expect(courseMatchesSelection(course, [], KCET_ENGINEERING_COURSE_OPTIONS)).toBe(false);
    });

    it('is case-insensitive on the selection label', () => {
      const course = { name: 'Civil Engineering', degreeType: 'B.E.' };
      expect(courseMatchesSelection(course, ['civil engineering'], KCET_ENGINEERING_COURSE_OPTIONS)).toBe(true);
    });
  });

  describe('courseMatchesDiscipline', () => {
    it('treats a missing discipline as Engineering', () => {
      expect(courseMatchesDiscipline({ name: 'x', degreeType: 'B.E.' }, 'Engineering')).toBe(true);
    });

    it('matches an explicit discipline value', () => {
      expect(courseMatchesDiscipline({ name: 'x', degreeType: 'B.Pharm', discipline: 'Pharmacy' }, 'Pharmacy')).toBe(true);
      expect(courseMatchesDiscipline({ name: 'x', degreeType: 'B.Pharm', discipline: 'Pharmacy' }, 'Engineering')).toBe(false);
    });
  });

  describe('allowedCategoriesForExam', () => {
    it('KCET has no EWS', () => {
      const cats = allowedCategoriesForExam('KCET')!;
      expect(cats).toEqual(KCET_CATEGORIES);
      expect(cats).not.toContain('EWS');
    });

    it('NEET includes EWS', () => {
      const cats = allowedCategoriesForExam('NEET')!;
      expect(cats).toEqual(NEET_CATEGORIES);
      expect(cats).toContain('EWS');
    });

    it('COMEDK has no category taxonomy (merit-only)', () => {
      expect(allowedCategoriesForExam('COMEDK')).toBeNull();
    });
  });

  describe('option list integrity', () => {
    it('every KCET engineering option has at least one keyword', () => {
      for (const opt of KCET_ENGINEERING_COURSE_OPTIONS) {
        expect(opt.keywords.length).toBeGreaterThan(0);
      }
    });

    it('every NEET option carries a degreeType', () => {
      for (const opt of NEET_COURSE_OPTIONS) {
        expect(opt.degreeType).toBeTruthy();
      }
    });

    it('option labels within each set are unique', () => {
      for (const set of [KCET_ENGINEERING_COURSE_OPTIONS, COMEDK_COURSE_OPTIONS, NEET_COURSE_OPTIONS]) {
        const labels = set.map(o => o.label);
        expect(new Set(labels).size).toBe(labels.length);
      }
    });
  });
});
