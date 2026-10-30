import { courseMatchesSelection, courseOptionsForExam } from '../../src/modules/predictions/utils/course-matcher.util';

describe('COMEDK course group matching', () => {
  const options = courseOptionsForExam('COMEDK');
  const selected = ['Computer Science & IT'];

  it.each([
    ['Computer Science & Engineering', true],
    ['Information Science & Engineering', true],
    ['Information Technology', true],
    ['Electrical & Electronics Engineering', false],
    ['Pharmacy', false],
  ])('matches %s to Computer Science & IT: %s', (name, expected) => {
    expect(courseMatchesSelection({ name, degreeType: 'B.E.', discipline: 'Engineering' }, selected, options)).toBe(expected);
  });
});
