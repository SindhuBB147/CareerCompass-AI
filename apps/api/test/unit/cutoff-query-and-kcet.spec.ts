import { ComedkCutoffAdapter, KcetCutoffAdapter, JosaaCutoffAdapter, NeetCutoffAdapter } from '../../src/modules/cutoffs/adapters/comedk-cutoff.adapter';
import { ExamCutoffQuery } from '../../src/modules/cutoffs/adapters/exam-cutoff-adapter.interface';
import * as fs from 'fs';
import * as path from 'path';

describe('Cutoff Query Layer, Adapter Filtering & KCET Ingestion', () => {
  let cutoffModel: any;

  beforeEach(() => {
    const execMock = jest.fn().mockResolvedValue([]);
    const sortMock = jest.fn().mockReturnValue({
      exec: execMock,
    });
    cutoffModel = {
      find: jest.fn().mockReturnValue({
        sort: sortMock,
        exec: execMock,
      }),
    };
  });

  describe('COMEDK Cutoff Adapter Filtering', () => {
    let adapter: ComedkCutoffAdapter;

    beforeEach(() => {
      adapter = new ComedkCutoffAdapter();
    });

    it('filters strictly by supplied fields and does not broaden query', async () => {
      const query: ExamCutoffQuery = {
        examCode: 'COMEDK',
        category: 'GM',
        collegeCode: 'E001',
        courseCode: 'CS',
        year: 2024,
        round: 2,
        quota: 'KKR',
      };

      await adapter.fetchHistoricalCutoffs(query, cutoffModel);

      expect(cutoffModel.find).toHaveBeenCalledWith(expect.objectContaining({
        examCode: 'COMEDK',
        category: 'GM',
        $or: [
          { collegeId: 'E001' },
          { collegeCode: 'E001' },
        ],
        $and: [
          {
            $or: [
              { courseId: 'CS' },
              { courseCode: 'CS' },
              { courseCode: expect.any(RegExp) },
            ],
          },
        ],
        year: 2024,
        round: 2,
        quota: 'KKR',
      }));
    });

    it('ignores year, round, and quota when not supplied in request', async () => {
      const query: ExamCutoffQuery = {
        examCode: 'COMEDK',
        category: 'GM',
        collegeId: 'E001',
        courseId: 'CS',
      };

      await adapter.fetchHistoricalCutoffs(query, cutoffModel);

      const findCallArgs = cutoffModel.find.mock.calls[0][0];
      expect(findCallArgs.year).toBeUndefined();
      expect(findCallArgs.round).toBeUndefined();
      expect(findCallArgs.quota).toBeUndefined();
    });

    it('normalizes category to uppercase', async () => {
      const query: ExamCutoffQuery = {
        examCode: 'COMEDK',
        category: 'kkr',
      };

      await adapter.fetchHistoricalCutoffs(query, cutoffModel);
      expect(cutoffModel.find).toHaveBeenCalledWith(expect.objectContaining({
        category: 'KKR',
      }));
    });
  });

  describe('KCET Adapter - Empty Raw Data Behavior', () => {
    let adapter: KcetCutoffAdapter;
    let rawPath: string;

    beforeAll(() => {
      const candidates = [
        path.resolve(process.cwd(), '../../../files/kcet/raw'),
        path.resolve(process.cwd(), '../../files/kcet/raw'),
        path.resolve(process.cwd(), '../files/kcet/raw'),
        path.resolve(process.cwd(), 'files/kcet/raw'),
        'C:/Users/sindh/Downloads/career-compass-ai/files/kcet/raw',
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          rawPath = c;
          break;
        }
      }
      if (!rawPath) {
        rawPath = candidates[0]; // fallback
      }
    });

    beforeEach(() => {
      adapter = new KcetCutoffAdapter();
    });

    it('identifies as unready and returns empty cutoffs (INSUFFICIENT_DATA fallback) when raw is empty', async () => {
      // Mock hasRawData to return false to simulate empty folder
      const hasRawDataSpy = jest.spyOn(adapter as any, 'hasRawData').mockReturnValue(false);
      
      expect(adapter.isReadyForEligibility()).toBe(false);

      const query: ExamCutoffQuery = {
        examCode: 'KCET',
        category: 'GM',
        collegeId: 'RVCE',
        courseId: 'CSE',
      };

      const result = await adapter.fetchHistoricalCutoffs(query, cutoffModel);
      expect(result).toEqual([]);
      expect(cutoffModel.find).not.toHaveBeenCalled();

      hasRawDataSpy.mockRestore();
    });
  });

  describe('KCET Adapter - Raw Data Present Behavior', () => {
    let adapter: KcetCutoffAdapter;
    let tempFilePath: string;

    beforeAll(() => {
      const candidates = [
        path.resolve(process.cwd(), '../../../files/kcet/raw'),
        path.resolve(process.cwd(), '../../files/kcet/raw'),
        path.resolve(process.cwd(), '../files/kcet/raw'),
        path.resolve(process.cwd(), 'files/kcet/raw'),
        'C:/Users/sindh/Downloads/career-compass-ai/files/kcet/raw',
      ];
      let resolvedDir = '';
      for (const c of candidates) {
        try {
          if (fs.existsSync(path.dirname(c))) {
            resolvedDir = c;
            break;
          }
        } catch {
          // ignore
        }
      }
      if (!resolvedDir) {
        resolvedDir = candidates[0];
      }

      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }

      tempFilePath = path.join(resolvedDir, 'temp_raw_dataset.csv');
      // Create a temporary raw file to trigger data-present behavior
      fs.writeFileSync(tempFilePath, 'dummy data contents', 'utf-8');
    });

    afterAll(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    beforeEach(() => {
      adapter = new KcetCutoffAdapter();
    });

    it('identifies as ready and executes query filtering when raw data is present', async () => {
      expect(adapter.isReadyForEligibility()).toBe(true);

      const query: ExamCutoffQuery = {
        examCode: 'KCET',
        category: 'GM',
        collegeCode: 'E005',
        courseCode: 'EC',
        year: 2024,
        round: 'Round 1',
        quota: 'HK',
      };

      await adapter.fetchHistoricalCutoffs(query, cutoffModel);

      expect(cutoffModel.find).toHaveBeenCalledWith(expect.objectContaining({
        examCode: 'KCET',
        category: 'GM',
        $or: [
          { collegeId: 'E005' },
          { collegeCode: 'E005' },
        ],
        year: 2024,
        round: 'Round 1',
        quota: 'HK',
      }));
    });
  });

  describe('JEE (JoSAA) & NEET Adapter Queries & Reports', () => {
    it('verifies Josaa/NEET adapters initialize and query correct exam codes', async () => {
      const josaa = new JosaaCutoffAdapter();
      const neet = new NeetCutoffAdapter();

      expect(josaa.examCode).toBe('JEE');
      expect(neet.examCode).toBe('NEET');

      await josaa.fetchHistoricalCutoffs({ examCode: 'JEE', category: 'OPEN', collegeCode: 'NITK', courseCode: 'CS' }, cutoffModel);
      expect(cutoffModel.find).toHaveBeenCalledWith(expect.objectContaining({ examCode: 'JEE' }));

      await neet.fetchHistoricalCutoffs({ examCode: 'NEET', category: 'UR', collegeCode: 'BMC', courseCode: 'MBBS' }, cutoffModel);
      expect(cutoffModel.find).toHaveBeenCalledWith(expect.objectContaining({ examCode: 'NEET' }));
    });

    it('returns empty reports for Josaa/NEET when no DB entries exist', async () => {
      const josaa = new JosaaCutoffAdapter();
      const report = await josaa.getReadinessReport(cutoffModel);
      expect(report.realRows).toBe(0);
      expect(report.examCode).toBe('JEE');
    });
  });
});
