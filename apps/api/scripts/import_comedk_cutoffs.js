const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { parsePdf } = require('./parse_comedk_cutoff_pdf');

const root = path.resolve(__dirname, '..');
const sourceFile = path.resolve(process.argv.slice(2).find((arg) => arg.toLowerCase().endsWith('.pdf')) ?? path.join(root, 'data/comedk-sources/COMEDK_2024_Round3.pdf'));
const manifestFile = path.join(root, 'data/comedk-sources/manifest.json');
const sourceStem = path.basename(sourceFile, path.extname(sourceFile));
const mappingFile = path.join(root, 'data/comedk-sources', `${sourceStem}-mapping-report.json`);
const isApply = process.argv.includes('--apply');

function readEnvValue(file, key) {
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
}

function safeCollegeMap(mappingReport) {
  const safeStatuses = new Set(['exact_college_name', 'exact_alias', 'exact_code_and_name']);
  const exact = mappingReport.database.collegeMappings
    .filter((entry) => safeStatuses.has(entry.status) && entry.candidates.length === 1)
    .map((entry) => [entry.sourceCode, entry.candidates[0]]);
  const idCounts = new Map();
  for (const [, candidate] of exact) idCounts.set(candidate.id, (idCounts.get(candidate.id) ?? 0) + 1);
  const collisions = exact.filter(([, candidate]) => idCounts.get(candidate.id) > 1).map(([sourceCode]) => sourceCode);
  const collisionCodes = new Set(collisions);
  return {
    map: new Map(exact.filter(([sourceCode]) => !collisionCodes.has(sourceCode))),
    collisionCodes,
  };
}

async function main() {
  if (!fs.existsSync(mappingFile)) throw new Error('Mapping report is missing; run audit_comedk_mappings.js first.');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const source = manifest.sources.find((entry) => entry.file === path.basename(sourceFile));
  if (!source || !source.url.startsWith('https://www.comedk.org/')) throw new Error('Official COMEDK source manifest entry is missing or invalid.');
  if (!Number.isInteger(source.year) || !Number.isInteger(source.round)) {
    throw new Error('This source does not identify a specific round. The current cutoff schema requires a round, so extraction is audit-only.');
  }
  const parsed = await parsePdf(sourceFile, { sourceYear: source.year });
  const mappingReport = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  if (!mappingReport.database.connected) throw new Error('Mapping report must be produced from a live, read-only database audit.');

  const { map: collegeMap, collisionCodes } = safeCollegeMap(mappingReport);
  const duplicateKeys = new Map();
  const rejects = [];
  const candidates = [];
  const sourceRows = parsed.rows;
  const rankCells = sourceRows.flatMap((row) => row.cells.map((cell) => ({ row, cell })));

  for (const { row, cell } of rankCells) {
    const mapped = collegeMap.get(row.collegeCode);
    if (!mapped) {
      rejects.push({ collegeCode: row.collegeCode, collegeName: row.collegeName, branchCode: cell.branchCode, reason: collisionCodes.has(row.collegeCode) ? 'multiple source colleges resolve to one internal college' : 'college mapping unresolved' });
      continue;
    }
    if (!Number.isInteger(cell.closingRank) || cell.closingRank < 1 || cell.closingRank > 2000000) {
      rejects.push({ collegeCode: row.collegeCode, branchCode: cell.branchCode, closingRank: cell.closingRank, reason: 'rank outside supported integer range' });
      continue;
    }
    if (!/^[A-Z]{1,4}$/.test(cell.branchCode) || !cell.branchName || !['GM', 'KKR'].includes(row.seatType)) {
      rejects.push({ collegeCode: row.collegeCode, branchCode: cell.branchCode, reason: 'invalid branch or source seat type' });
      continue;
    }

    const record = {
      // The cutoff model references College._id as a string, not the human
      // admission code in College.collegeId.
      collegeId: mapped.id,
      courseId: cell.branchCode,
      courseName: cell.branchName,
      sourceBranchName: cell.sourceBranchName,
      branch: cell.branchName,
      examCode: 'COMEDK',
      year: source.year,
      round: source.round,
      category: row.seatType,
      closingRank: cell.closingRank,
      sourceCode: row.collegeCode,
      sourceCollegeName: row.collegeName,
      sourceBranchCode: cell.branchCode,
      sourcePage: row.page,
      sourceKey: `COMEDK:${source.year}:R${source.round}:${row.collegeCode}:${cell.branchCode}:${row.seatType}`,
    };
    const key = `${record.collegeId}|${record.courseId}|${record.examCode}|${record.year}|${record.round}|${record.category}`;
    if (duplicateKeys.has(key)) {
      rejects.push({ sourceKey: record.sourceKey, reason: `duplicate cutoff identity also seen at page ${duplicateKeys.get(key)}` });
      continue;
    }
    duplicateKeys.set(key, row.page);
    candidates.push(record);
  }

  const uri = readEnvValue(path.join(root, '.env'), 'MONGO_URI');
  if (!uri) throw new Error('MONGO_URI is not configured in apps/api/.env.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const cutoffCollection = mongoose.connection.db.collection('cutoffs');
    const existingComedkCount = await cutoffCollection.countDocuments({ examCode: 'COMEDK' });
    const sourceKeys = candidates.map((record) => record.sourceKey);
    const existingBySourceKey = new Map((await cutoffCollection.find({
      examCode: 'COMEDK', 'metadata.sourceFile': path.basename(sourceFile), 'metadata.sourceKey': { $in: sourceKeys },
    }).toArray()).map((record) => [record.metadata.sourceKey, record]));
    const identityConflicts = new Map();
    const existingSameSource = new Map();
    const identityRepairs = [];
    const courseNameCorrections = [];
    for (const record of candidates) {
      const existing = await cutoffCollection.findOne({
        collegeId: record.collegeId, courseId: record.courseId, examCode: 'COMEDK',
        category: record.category, year: record.year, round: record.round,
      });
      if (existing) {
        if (existing.metadata?.sourceKey === record.sourceKey) existingSameSource.set(record.sourceKey, existing);
        else identityConflicts.set(record.sourceKey, existing);
      }
      const imported = existingBySourceKey.get(record.sourceKey);
      if (imported && String(imported.collegeId) !== record.collegeId) {
        identityRepairs.push({ record, existing: imported });
      } else if (imported && !identityConflicts.has(record.sourceKey)) {
        existingSameSource.set(record.sourceKey, imported);
        if (imported.courseName !== record.courseName || imported.metadata?.comedkBranchName !== record.sourceBranchName) {
          courseNameCorrections.push({ record, existing: imported });
        }
      }
    }

    const mappingCounts = mappingReport.database.collegeMappingCounts;
    const mappedCollegeCount = collegeMap.size;
    const report = {
      mode: isApply ? 'apply' : 'dry-run',
      source: { url: source.url, file: path.basename(sourceFile), year: source.year, round: source.round, phase: source.phase ?? null, retrievedAt: source.retrievedAt },
      sourceRows: sourceRows.length,
      validRankCells: rankCells.length,
      rejectedCellsByParser: parsed.rejectedRankSamples.length,
      mappedColleges: mappedCollegeCount,
      sourceColleges: new Set(candidates.map((record) => record.sourceCode)).size,
      mappedBranches: new Set(candidates.map((record) => record.sourceBranchCode)).size,
      uniqueCollegeBranchCutoffs: candidates.length,
      duplicateRecords: rejects.filter((entry) => entry.reason.startsWith('duplicate cutoff identity')).length,
      excludedCollidingSourceColleges: collisionCodes.size,
      excludedCollidingMappings: rejects.filter((entry) => entry.reason.startsWith('multiple source colleges')).length,
      excludedUnresolvedMappings: rejects.filter((entry) => entry.reason === 'college mapping unresolved').length,
      validationRejected: rejects.filter((entry) => entry.reason !== 'college mapping unresolved' && !entry.reason.startsWith('multiple source colleges') && !entry.reason.startsWith('duplicate cutoff identity')).length,
      existingComedkRecordsBeforeImport: existingComedkCount,
      existingIdentityConflicts: identityConflicts.size,
      mappedCollegeIdRepairs: identityRepairs.length,
      mappedCourseNameCorrections: courseNameCorrections.length,
      alreadyImportedRecords: existingSameSource.size,
      newRecordsToInsert: candidates.filter((record) => !identityConflicts.has(record.sourceKey) && !existingSameSource.has(record.sourceKey) && !identityRepairs.some((repair) => repair.record.sourceKey === record.sourceKey)).length,
      mappingCounts,
      rejectedSamples: rejects.slice(0, 20),
      importPolicy: 'Unmatched or ambiguous college mappings are excluded. Existing cutoff identities are never overwritten. Source branch codes are stored unchanged in courseId and provenance metadata. Only verified values from the official source may be returned by COMEDK predictions.',
    };

    if ((source.expectedPages && parsed.pageCount !== source.expectedPages) || parsed.pageCount <= 0 || parsed.rejectedRankSamples.length > 0 || rejects.some((entry) => entry.reason !== 'college mapping unresolved' && !entry.reason.startsWith('multiple source colleges') && !entry.reason.startsWith('duplicate cutoff identity'))) {
      throw new Error(`Source validation failed; refusing import. Report: ${JSON.stringify(report)}`);
    }

    if (isApply) {
      if (identityConflicts.size > 0) throw new Error(`Existing cutoff identities found; refusing overwrite. Report: ${JSON.stringify(report)}`);
      const repairOperations = identityRepairs.map(({ record, existing }) => ({
        updateOne: {
          filter: { _id: existing._id, examCode: 'COMEDK', 'metadata.sourceFile': path.basename(sourceFile), 'metadata.sourceKey': record.sourceKey },
          update: { $set: { collegeId: record.collegeId } },
        },
      }));
      const operations = candidates.filter((record) => !identityRepairs.some((repair) => repair.record.sourceKey === record.sourceKey) && !existingSameSource.has(record.sourceKey)).map((record) => ({
        updateOne: {
          filter: {
            collegeId: record.collegeId, courseId: record.courseId, examCode: 'COMEDK',
            category: record.category, year: record.year, round: record.round,
          },
          update: { $setOnInsert: {
            collegeId: record.collegeId,
            courseId: record.courseId,
            courseName: record.courseName,
            branch: record.branch,
            examCode: record.examCode,
            year: record.year,
            round: record.round,
            category: record.category,
            closingRank: record.closingRank,
            source: 'official',
            verifiedBy: null,
            status: 'verified',
            lastUpdated: new Date(),
            metadata: {
              sourceUrl: source.url,
              sourceFile: path.basename(sourceFile),
              retrievalDate: source.retrievedAt,
              sourceYear: source.year,
              sourceRound: source.round,
              sourcePhase: source.phase ?? null,
              sourcePage: record.sourcePage,
              comedkCollegeCode: record.sourceCode,
              comedkCollegeName: record.sourceCollegeName,
              comedkBranchCode: record.sourceBranchCode,
              comedkBranchName: record.sourceBranchName,
              comedkBranchCanonicalName: record.courseName,
              comedkSeatType: record.category,
              sourceKey: record.sourceKey,
              verificationMethod: 'Official COMEDK source PDF; source page retained; exact unique internal college mapping; official branch code retained.',
            },
          } },
          upsert: true,
        },
      }));
      if (identityRepairs.length) await cutoffCollection.bulkWrite(repairOperations, { ordered: false });
      const courseNameOperations = courseNameCorrections.map(({ record, existing }) => ({
        updateOne: {
          filter: { _id: existing._id, examCode: 'COMEDK', 'metadata.sourceFile': path.basename(sourceFile), 'metadata.sourceKey': record.sourceKey },
          update: { $set: {
            courseName: record.courseName,
            branch: record.courseName,
            'metadata.comedkBranchName': record.sourceBranchName,
            'metadata.comedkBranchCanonicalName': record.courseName,
          } },
        },
      }));
      if (courseNameOperations.length) await cutoffCollection.bulkWrite(courseNameOperations, { ordered: false });
      const result = operations.length ? await cutoffCollection.bulkWrite(operations, { ordered: false }) : { upsertedCount: 0, matchedCount: 0 };
      report.insertedCount = result.upsertedCount;
      report.mappedCollegeIdRepairsApplied = identityRepairs.length;
      report.mappedCourseNameCorrectionsApplied = courseNameOperations.length;
      report.matchedExistingCount = result.matchedCount;
      report.verifiedComedkRecordsAfterImport = await cutoffCollection.countDocuments({ examCode: 'COMEDK', status: 'verified' });
      report.verifiedSourceRecords = await cutoffCollection.countDocuments({
        examCode: 'COMEDK', status: 'verified', 'metadata.sourceFile': path.basename(sourceFile),
      });
      const appliedAt = new Date().toISOString();
      manifest.sources = manifest.sources.map((entry) => entry.file === source.file
        ? {
          ...entry,
          parsingStatus: 'imported_verified',
          statusReason: `${report.verifiedSourceRecords} exact-mapped official COMEDK rows imported; unresolved and colliding college mappings were excluded.`,
          importedAt: entry.importedAt ?? (result.upsertedCount > 0 ? appliedAt : null),
          importedRecords: report.verifiedSourceRecords,
          lastAppliedAt: appliedAt,
          lastRunInserted: result.upsertedCount,
          lastRunCollegeIdRepairs: identityRepairs.length,
          lastRunCourseNameCorrections: courseNameOperations.length,
          verifiedRecords: report.verifiedComedkRecordsAfterImport,
          excludedUnresolvedMappings: report.excludedUnresolvedMappings,
          excludedCollidingMappings: report.excludedCollidingMappings,
        }
        : entry);
      fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    }

    const reportPath = path.join(root, 'data/comedk-sources', `${sourceStem}-import-${isApply ? 'result' : 'dry-run'}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
