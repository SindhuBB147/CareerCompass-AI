const path = require('node:path');
const { parsePdf } = require('../../scripts/parse_comedk_cutoff_pdf');

const sourcePath = (filename: string) => path.resolve(__dirname, '../../data/comedk-sources', filename);
const record = (rows: any[], collegeCode: string, category: string, branchCode: string, rank: number) =>
  rows.flatMap((row) => row.cells.map((cell: any) => ({ row, cell }))).find(({ row, cell }: any) =>
    row.collegeCode === collegeCode && row.category === category && cell.branchCode === branchCode && cell.closingRank === rank,
  );

describe('COMEDK official cutoff PDF layouts', () => {
  jest.setTimeout(30000);

  it('maps the low-baseline Round 1 rank under its DS heading', async () => {
    const parsed = await parsePdf(sourcePath('COMEDK_2024_Round1.pdf'), { sourceYear: 2024 });
    expect(record(parsed.rows, 'E209', 'GM', 'DS', 101425)).toBeDefined();
    expect(parsed.rejectedRankSamples).toHaveLength(0);
  });

  it('maps the Round 2 Phase 2 ranks under their visually verified headings', async () => {
    const parsed = await parsePdf(sourcePath('COMEDK_2024_Round2_Phase2.pdf'), { sourceYear: 2024 });
    expect(record(parsed.rows, 'E211', 'GM', 'AE', 89865)).toBeDefined();
    expect(record(parsed.rows, 'E211', 'GM', 'CS', 94269)).toBeDefined();
    expect(record(parsed.rows, 'E212', 'GM', 'CS', 90114)).toBeDefined();
    expect(record(parsed.rows, 'E212', 'GM', 'IS', 59194)).toBeDefined();
    expect(parsed.rejectedRankSamples).toHaveLength(0);
  });

  it('extracts 2023 all-rounds data with the source-specific columns and leaves round unspecified', async () => {
    const parsed = await parsePdf(sourcePath('COMEDK_2023_AllRounds.pdf'), { sourceYear: 2023 });
    expect(record(parsed.rows, 'E004', 'GM', 'AI', 38997)).toBeDefined();
    expect(record(parsed.rows, 'E016', 'GM', 'AM', 47768)).toBeDefined();
    expect(parsed.rows.length).toBeGreaterThan(1000);
    expect(parsed.rows.flatMap((row: any) => row.cells)).toHaveLength(532);
    expect(parsed.rejectedRankSamples).toHaveLength(49);
  });
});
