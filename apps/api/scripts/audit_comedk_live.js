// Read-only COMEDK database audit and source dry-run. This script never writes to MongoDB.
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { parsePdf } = require('./parse_comedk_cutoff_pdf');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data/comedk-sources');
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'manifest.json'), 'utf8'));
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const sourceFiles = requested.length ? requested : [
  'COMEDK_2024_Round1.pdf', 'COMEDK_2024_Round2_Phase1.pdf',
  'COMEDK_2024_Round2_Phase2.pdf', 'COMEDK_2024_Round3.pdf',
];
const envLine = fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).find((line) => /^\s*MONGO_URI=/.test(line));
const uri = process.env.MONGO_URI || envLine?.replace(/^\s*MONGO_URI=/, '').trim().replace(/^['"]|['"]$/g, '');
if (!uri) throw new Error('MONGO_URI is not configured in environment or apps/api/.env.');

function safeTarget(value) {
  const parsed = new URL(value);
  return `${parsed.hostname}:${parsed.port || '27017'}/${parsed.pathname.replace(/^\//, '')}`;
}
function safeMapping(mappingReport) {
  const accepted = new Set(['exact_college_name', 'exact_alias', 'exact_code_and_name']);
  const entries = mappingReport.database.collegeMappings || [];
  const exact = entries.filter((entry) => accepted.has(entry.status) && entry.candidates?.length === 1);
  const ids = new Map();
  for (const entry of exact) ids.set(String(entry.candidates[0].id), (ids.get(String(entry.candidates[0].id)) || 0) + 1);
  const collisions = exact.filter((entry) => ids.get(String(entry.candidates[0].id)) > 1);
  const collisionCodes = new Set(collisions.map((entry) => String(entry.sourceCode)));
  return { entries, map: new Map(exact.filter((entry) => !collisionCodes.has(String(entry.sourceCode))).map((entry) => [String(entry.sourceCode), entry.candidates[0]])), collisionCodes };
}
function identity(doc) {
  return [String(doc.collegeId), String(doc.courseId), String(doc.examCode).toUpperCase(), String(doc.year), String(doc.round), String(doc.category)].join('|');
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const colleges = db.collection('colleges');
  const cutoffs = db.collection('cutoffs');
  const result = {
    generatedAt: new Date().toISOString(),
    connection: { status: 'connected', mode: 'persistent', target: safeTarget(uri), database: db.databaseName },
    collections: [], counts: {}, groupedComedk: [], indexes: {}, duplicateIdentityGroups: [], sources: [], savedReports: [],
    safety: 'Read-only: no insert, update, delete, index creation, or database-side writes are performed.',
  };
  if (db.databaseName !== 'career-compass-dev') throw new Error(`Connected database is ${db.databaseName}; expected career-compass-dev. Refusing audit.`);
  result.collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).sort();
  result.counts = {
    colleges: await colleges.countDocuments({}),
    cutoffs: await cutoffs.countDocuments({}),
    KCET: await cutoffs.countDocuments({ examCode: 'KCET' }),
    COMEDK: await cutoffs.countDocuments({ examCode: 'COMEDK' }),
  };
  result.groupedComedk = await cutoffs.aggregate([
    { $match: { examCode: 'COMEDK' } },
    { $group: { _id: { year: '$year', round: '$round', category: '$category' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.round': 1, '_id.category': 1 } },
  ]).toArray();
  result.indexes = { cutoffs: await cutoffs.indexes(), colleges: await colleges.indexes() };
  result.duplicateIdentityGroups = await cutoffs.aggregate([
    { $group: { _id: { collegeId: '$collegeId', courseId: '$courseId', examCode: '$examCode', category: '$category', year: '$year', round: '$round' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }, { $limit: 500 },
  ]).toArray();

  for (const file of sourceFiles) {
    const source = manifest.sources.find((item) => item.file === file);
    if (!source || !source.url?.startsWith('https://www.comedk.org/')) throw new Error(`No official manifest entry for ${file}`);
    const stem = path.basename(file, '.pdf');
    const mappingPath = path.join(dataDir, `${stem}-mapping-report.json`);
    if (!fs.existsSync(mappingPath)) throw new Error(`Missing mapping report: ${path.basename(mappingPath)}`);
    const mappingReport = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const { entries, map, collisionCodes } = safeMapping(mappingReport);
    const parsed = await parsePdf(path.join(dataDir, file), { sourceYear: source.year });
    const candidates = [], excluded = [], seen = new Map();
    for (const row of parsed.rows) for (const cell of row.cells) {
      const college = map.get(String(row.collegeCode));
      const reason = !college ? (collisionCodes.has(String(row.collegeCode)) ? 'college mapping collision' : 'college mapping unresolved')
        : !Number.isInteger(cell.closingRank) || cell.closingRank < 1 || cell.closingRank > 2000000 ? 'invalid rank'
          : !/^[A-Z]{1,4}$/.test(cell.branchCode) || !cell.branchName || !['GM', 'KKR'].includes(row.seatType) ? 'invalid branch or seat type'
            : !Number.isInteger(source.round) ? 'source round missing' : null;
      if (reason) { excluded.push({ collegeCode: row.collegeCode, collegeName: row.collegeName, branchCode: cell.branchCode, seatType: row.seatType, closingRank: cell.closingRank, page: row.page, reason }); continue; }
      const candidate = { collegeId: String(college.id), courseId: cell.branchCode, examCode: 'COMEDK', year: source.year, round: source.round, category: row.seatType, sourceCode: row.collegeCode, branchName: cell.branchName, page: row.page, closingRank: cell.closingRank, sourceKey: `COMEDK:${source.year}:R${source.round}:${row.collegeCode}:${cell.branchCode}:${row.seatType}` };
      const key = identity(candidate);
      if (seen.has(key)) { excluded.push({ ...candidate, reason: `duplicate candidate identity (also page ${seen.get(key)})` }); continue; }
      seen.set(key, row.page); candidates.push(candidate);
    }
    const conflicts = [], alreadyImported = [], wouldInsert = [];
    for (const candidate of candidates) {
      const existing = await cutoffs.findOne({ collegeId: candidate.collegeId, courseId: candidate.courseId, examCode: 'COMEDK', year: candidate.year, round: candidate.round, category: candidate.category });
      if (!existing) { wouldInsert.push(candidate); continue; }
      if (existing.metadata?.sourceKey === candidate.sourceKey) alreadyImported.push(candidate);
      else conflicts.push({ candidate, existingId: String(existing._id), existingSourceKey: existing.metadata?.sourceKey ?? null });
    }
    result.sources.push({ file, url: source.url, year: source.year, round: source.round, phase: source.phase ?? null, savedManifestStatus: source.parsingStatus, parsedRows: parsed.rows.length, populatedRankCells: parsed.rows.reduce((n, row) => n + row.cells.length, 0), parserRejected: parsed.rejectedRankSamples, sourceColleges: [...new Set(parsed.rows.map((row) => String(row.collegeCode)))].length, mapping: { databaseConnectedInSavedReport: mappingReport.database?.connected, mappingStatuses: mappingReport.database?.collegeMappingCounts, exactSafeCollegeMappings: map.size, collisionSourceCodes: [...collisionCodes], unresolvedOrAmbiguous: entries.filter((entry) => !['exact_college_name', 'exact_alias', 'exact_code_and_name'].includes(entry.status) || entry.candidates?.length !== 1) }, candidates: candidates.length, branchCodes: [...new Set(candidates.map((item) => item.courseId))].sort(), excluded, duplicateCandidates: excluded.filter((item) => String(item.reason).startsWith('duplicate candidate identity')).length, conflicts, alreadyImported: alreadyImported.length, wouldInsert: wouldInsert.length, idempotent: wouldInsert.length === 0 && conflicts.length === 0, writesPerformed: 0 });
    const reportPath = path.join(dataDir, `${stem}-live-dry-run-${Date.now()}.json`);
    result.sources[result.sources.length - 1].reportFile = path.basename(reportPath);
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: result.generatedAt, connection: result.connection, counts: result.counts, source: result.sources[result.sources.length - 1] }, null, 2) + '\n', { flag: 'wx' });
  }
  result.savedReports = manifest.sources.filter((source) => source.year === 2024).map((source) => ({ file: source.file, status: source.parsingStatus, importedRecords: source.importedRecords ?? null, verifiedRecords: source.verifiedRecords ?? null, lastRunInserted: source.lastRunInserted ?? null, excludedUnresolvedMappings: source.excludedUnresolvedMappings ?? null, excludedCollidingMappings: source.excludedCollidingMappings ?? null }));
  const auditPath = path.join(dataDir, `live-database-audit-${Date.now()}.json`);
  fs.writeFileSync(auditPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ reportFile: path.basename(auditPath), ...result }, null, 2));
}

main().catch((error) => { console.error(`Read-only audit failed: ${error.message}`); process.exitCode = 1; }).finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });
