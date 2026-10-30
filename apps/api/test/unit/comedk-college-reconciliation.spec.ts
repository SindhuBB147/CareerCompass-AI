import reconciliation = require('../../scripts/reconcile_comedk_colleges');
const { institutionName, normalize, scoreTarget, discoverCandidates } = reconciliation;

const college = (overrides = {}) => ({ collegeId: 'E030', name: 'KLE Technological University', aliasNames: ['BVBCET', 'KLE Tech'], city: 'Hubballi', district: 'Dharwad', address: 'Vidyanagar, Hubballi', alternateAdmissionCodes: [], ...overrides });

describe('COMEDK college identity discovery', () => {
  test('importing the CLI module does not run the live audit', () => {
    const mongoose = require('mongoose');
    const connect = jest.spyOn(mongoose, 'connect');
    jest.isolateModules(() => require('../../scripts/reconcile_comedk_colleges'));
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });
  test('removes PDF location suffix before institution matching', () => {
    expect(institutionName('KLE Technological University - Vidyanagar, Hubballi')).toBe('KLE Technological University');
  });
  test('normalizes punctuation and spacing', () => {
    expect(normalize('P.E.S.  College-of Engineering')).toBe(normalize('PES College of Engineering'));
  });
  test('finds normalized aliases', () => {
    const candidate = scoreTarget({ code: 'E016', name: 'B.V. Bhoomaraddi College of Engineering and Technology - Hubballi' }, college());
    expect(candidate.exactAlias).toBe(true);
  });
  test('expands known abbreviations such as VVCE', () => {
    expect(normalize('VVCE')).toBe(normalize('Vidya Vardhaka College of Engineering'));
  });
  test('flags south and north campus as distinct', () => {
    const candidate = scoreTarget({ code: 'E142', name: 'National Institute of Engineering South Campus - Mysuru' }, college({ name: 'The National Institute of Engineering, North Campus', aliasNames: ['NIE North Campus'] }));
    expect(candidate.distinctCampusWarning).toBe(true);
  });
  test('returns all candidates satisfying discovery signals without top-N truncation', () => {
    const colleges = Array.from({ length: 18 }, (_, i) => college({ collegeId: `C${i}`, name: `KLE Institute ${i}` }));
    colleges.push(college({ collegeId: 'EXPECTED', name: 'KLE Technological University' }));
    expect(discoverCandidates({ code: 'E016', name: 'KLE Technological University - Hubballi' }, colleges).relevant.some((item) => item.id === 'EXPECTED')).toBe(true);
  });
  test('detects a conflicting existing alternate COMEDK code', () => {
    const candidate = scoreTarget({ code: 'E072', name: 'KLE Institute of Technology - Hubballi' }, college({ name: 'KLE Institute of Technology', alternateAdmissionCodes: [{ code: 'E163', examBody: 'COMEDK' }] }));
    expect(candidate.alternateAdmissionCodes[0].code).toBe('E163');
    expect(candidate.exactCode).toBe(false);
  });
  test('never approves fuzzy matches automatically', () => {
    const candidate = scoreTarget({ code: 'E016', name: 'KLE Technological University - Hubballi' }, college({ name: 'KLE Institute of Technology' }));
    expect(candidate.automaticApproval).toBe(false);
  });
  test('excludes unrelated low-similarity candidates from relevant matches', () => {
    const result = discoverCandidates({ code: 'E027', name: 'BMS College of Engineering - Bengaluru' }, [college({ collegeId: 'P', name: 'Bangalore College of Pharmacy' })]);
    expect(result.relevant).toHaveLength(0);
  });
  test('generic institution words do not establish a match', () => {
    const result = discoverCandidates({ code: 'E027', name: 'BMS College of Engineering - Bengaluru' }, [college({ collegeId: 'G', name: 'Institute of Engineering and Technology', city: 'Unknown' })]);
    expect(result.relevant).toHaveLength(0);
  });
  test('recognizes historical institution names as evidence', () => {
    const c = scoreTarget({ code: 'E016', name: 'Bhoomaraddi College of Engineering and Technology - Hubballi' }, college({ historicalNames: ['Bhoomaraddi College of Engineering and Technology'] }));
    expect(c.exactHistoricalName).toBe(true);
  });
  test('requires both strong name similarity and location evidence', () => {
    const c = scoreTarget({ code: 'E147', name: 'Vidya Vardhaka College of Engineering - Gokulam Mysuru' }, college({ name: 'Vidya Vardhaka College of Engineering Institute', address: 'Gokulam Mysuru' }));
    expect(c.evidence).toBe('strong normalized name similarity supported by location');
  });
  test('flags genuine campus conflict only for matching institution cores', () => {
    const c = scoreTarget({ code: 'NIE-S', name: 'National Institute of Engineering South Campus - Mysuru' }, college({ name: 'National Institute of Engineering North Campus' }));
    expect(c.distinctCampusWarning).toBe(true);
  });
  test('does not flag unrelated colleges as campus conflicts', () => {
    const c = scoreTarget({ code: 'E027', name: 'BMS College of Engineering - Bengaluru' }, college({ name: 'BMS Institute of Technology, North Campus' }));
    expect(c.distinctCampusWarning).toBe(false);
  });
});
