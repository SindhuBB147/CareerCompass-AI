import * as fs from 'fs';
import * as path from 'path';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

interface IngestionRow {
  exam: string;
  year: number;
  round: string | number;
  counsellingAuthority: string;
  collegeCode: string;
  collegeName: string;
  courseCode: string;
  courseName: string;
  category: string;
  quota: string | null;
  openingRank: number | null;
  closingRank: number;
  state: string;
  collegeType: string;
  source: string;
}

function findDirectories() {
  const root = path.resolve(process.cwd(), '../files');
  const rootAlt = path.resolve(process.cwd(), 'files');
  const rootAlt2 = 'C:/Users/sindh/Downloads/career-compass-ai/files';

  for (const r of [root, rootAlt, rootAlt2]) {
    if (fs.existsSync(r)) {
      return {
        raw: path.join(r, 'kcet', 'raw'),
        processed: path.join(r, 'kcet', 'processed'),
        reports: path.join(r, 'kcet', 'reports'),
        cleanDest: path.join(r, 'kcet_cutoffs_clean.csv'),
      };
    }
  }
  throw new Error('Files root directory not found.');
}

async function ingest() {
  const dirs = findDirectories();
  console.log('KCET Raw data directory:', dirs.raw);

  if (!fs.existsSync(dirs.raw)) {
    console.log('KCET raw directory does not exist. Skipping.');
    return;
  }

  const rawFiles = fs.readdirSync(dirs.raw).filter(f => {
    return !f.startsWith('.') && f !== 'placeholder.txt' && (f.endsWith('.csv') || f.endsWith('.txt'));
  });

  if (rawFiles.length === 0) {
    console.log('No raw files found under files/kcet/raw/. Ingestion skipped.');
    return;
  }

  console.log(`Found ${rawFiles.length} raw files to process:`, rawFiles);

  const allRecords: IngestionRow[] = [];
  const reportLog: string[] = [];

  let totalRowsRead = 0;
  let skippedEmptyCollege = 0;
  let skippedEmptyCourse = 0;
  let skippedInvalidRank = 0;
  let skippedInvalidYear = 0;
  let skippedInvalidRound = 0;

  for (const rawFile of rawFiles) {
    const filePath = path.join(dirs.raw, rawFile);
    console.log(`Reading: ${rawFile}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) continue;

    const header = parseCsvLine(lines[0]);
    
    // Find column indexes
    const idxExam = header.indexOf('exam');
    const idxYear = header.indexOf('year');
    const idxRound = header.indexOf('round');
    const idxCounselling = header.indexOf('counsellingAuthority');
    const idxCollegeCode = header.indexOf('collegeCode');
    const idxCollegeName = header.indexOf('collegeName');
    const idxCourseCode = header.indexOf('courseCode');
    const idxCourseName = header.indexOf('courseName');
    const idxCategory = header.indexOf('category');
    const idxQuota = header.indexOf('quota');
    const idxOpeningRank = header.indexOf('openingRank');
    const idxClosingRank = header.indexOf('closingRank');
    const idxState = header.indexOf('state');
    const idxCollegeType = header.indexOf('collegeType');

    for (let i = 1; i < lines.length; i++) {
      totalRowsRead++;
      const row = parseCsvLine(lines[i]);
      if (row.length < header.length) {
        continue;
      }

      const collegeCode = row[idxCollegeCode]?.trim();
      if (!collegeCode) {
        skippedEmptyCollege++;
        continue;
      }

      const courseCode = row[idxCourseCode]?.trim();
      if (!courseCode) {
        skippedEmptyCourse++;
        continue;
      }

      const year = parseInt(row[idxYear]?.trim(), 10);
      if (isNaN(year) || year < 2000 || year > 2100) {
        skippedInvalidYear++;
        continue;
      }

      const round = row[idxRound]?.trim();
      if (!round) {
        skippedInvalidRound++;
        continue;
      }

      const closingRank = parseInt(row[idxClosingRank]?.trim(), 10);
      if (isNaN(closingRank) || closingRank <= 0) {
        skippedInvalidRank++;
        continue;
      }

      const openingRankVal = row[idxOpeningRank]?.trim();
      const openingRank = (openingRankVal && !isNaN(parseInt(openingRankVal, 10))) 
        ? parseInt(openingRankVal, 10) 
        : null;

      const examVal = idxExam !== -1 ? row[idxExam]?.trim() : 'KCET';
      const counsellingVal = idxCounselling !== -1 ? row[idxCounselling]?.trim() : 'KEA';
      const collegeNameVal = idxCollegeName !== -1 ? row[idxCollegeName]?.trim() : '';
      const courseNameVal = idxCourseName !== -1 ? row[idxCourseName]?.trim() : '';
      const categoryVal = idxCategory !== -1 ? row[idxCategory]?.trim().toUpperCase() : 'GM';
      const quotaVal = (idxQuota !== -1 && row[idxQuota]?.trim()) ? row[idxQuota]?.trim() : null;
      const stateVal = idxState !== -1 ? row[idxState]?.trim() : 'Karnataka';
      const typeVal = idxCollegeType !== -1 ? row[idxCollegeType]?.trim() : 'Government';

      allRecords.push({
        exam: examVal,
        year,
        round,
        counsellingAuthority: counsellingVal,
        collegeCode,
        collegeName: collegeNameVal,
        courseCode,
        courseName: courseNameVal,
        category: categoryVal,
        quota: quotaVal,
        openingRank,
        closingRank,
        state: stateVal,
        collegeType: typeVal,
        source: rawFile,
      });
    }
  }

  // Detect and resolve duplicates/conflicts
  const finalRecordsMap = new Map<string, IngestionRow>();
  const conflictsResolvedLog: string[] = [];
  let duplicatesFoundCount = 0;

  for (const record of allRecords) {
    // Grain key
    const key = `${record.year}-${record.round}-${record.collegeCode}-${record.courseCode}-${record.category}-${record.quota ?? 'null'}`;
    const existing = finalRecordsMap.get(key);

    if (existing) {
      duplicatesFoundCount++;
      if (record.closingRank < existing.closingRank) {
        conflictsResolvedLog.push(`Conflict at ${key}: incoming closing_rank (${record.closingRank}) is lower than existing (${existing.closingRank}). Kept incoming lower rank.`);
        finalRecordsMap.set(key, record);
      } else {
        conflictsResolvedLog.push(`Conflict at ${key}: incoming closing_rank (${record.closingRank}) is higher than or equal to existing (${existing.closingRank}). Discarded incoming.`);
      }
    } else {
      finalRecordsMap.set(key, record);
    }
  }

  const finalRecordsList = Array.from(finalRecordsMap.values());

  // Generate cleaned CSV
  const headerRow = 'exam,year,round,counsellingAuthority,collegeCode,collegeName,courseCode,courseName,category,quota,openingRank,closingRank,state,collegeType,source';
  const csvLines = [headerRow];

  for (const rec of finalRecordsList) {
    const line = [
      `"${rec.exam}"`,
      rec.year,
      `"${rec.round}"`,
      `"${rec.counsellingAuthority}"`,
      `"${rec.collegeCode}"`,
      `"${rec.collegeName.replace(/"/g, '""')}"`,
      `"${rec.courseCode}"`,
      `"${rec.courseName.replace(/"/g, '""')}"`,
      `"${rec.category}"`,
      rec.quota ? `"${rec.quota}"` : '',
      rec.openingRank !== null ? rec.openingRank : '',
      rec.closingRank,
      `"${rec.state}"`,
      `"${rec.collegeType}"`,
      `"${rec.source}"`,
    ].join(',');
    csvLines.push(line);
  }

  const cleanFileFolder = dirs.processed;
  if (!fs.existsSync(cleanFileFolder)) {
    fs.mkdirSync(cleanFileFolder, { recursive: true });
  }

  const cleanCsvPath = path.join(cleanFileFolder, 'kcet_cutoffs_clean.csv');
  fs.writeFileSync(cleanCsvPath, csvLines.join('\n'), 'utf-8');
  console.log(`Cleaned CSV written to: ${cleanCsvPath}`);

  // Copy to files/kcet_cutoffs_clean.csv
  fs.writeFileSync(dirs.cleanDest, csvLines.join('\n'), 'utf-8');
  console.log(`Cleaned CSV copied to: ${dirs.cleanDest}`);

  // Write Quality Report
  const reportFolder = dirs.reports;
  if (!fs.existsSync(reportFolder)) {
    fs.mkdirSync(reportFolder, { recursive: true });
  }

  const reportMarkdown = `# KCET Data Quality Report

* **Generated on:** ${new Date().toISOString()}
* **Total Raw Files Processed:** ${rawFiles.length}

## Metrics Summary

| Metric | Count |
|---|---|
| Total rows read | ${totalRowsRead} |
| Valid rows processed | ${finalRecordsList.length} |
| Duplicate rows resolved | ${duplicatesFoundCount} |
| Skipped due to missing collegeCode | ${skippedEmptyCollege} |
| Skipped due to missing courseCode | ${skippedEmptyCourse} |
| Skipped due to invalid rank | ${skippedInvalidRank} |
| Skipped due to invalid year | ${skippedInvalidYear} |
| Skipped due to invalid round | ${skippedInvalidRound} |

## Duplicates Resolution Log

${conflictsResolvedLog.length > 0 ? conflictsResolvedLog.map(l => `* ${l}`).join('\n') : 'No duplicate rows or conflicts resolved.'}
`;

  const reportPath = path.join(reportFolder, 'kcet_data_quality_report.md');
  fs.writeFileSync(reportPath, reportMarkdown, 'utf-8');
  console.log(`Data Quality Report written to: ${reportPath}`);
}

ingest().catch(err => {
  console.error('Ingestion script failed:', err);
  process.exit(1);
});
