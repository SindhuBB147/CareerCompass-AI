const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { parsePdf } = require('./parse_comedk_cutoff_pdf');

const root = path.resolve(__dirname, '..');
const sourceFile = path.resolve(process.argv[2] ?? path.join(root, 'data/comedk-sources/COMEDK_2024_Round3.pdf'));
const manifestFile = path.join(root, 'data/comedk-sources/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const sourceEntry = manifest.sources.find((entry) => entry.file === path.basename(sourceFile));
if (!sourceEntry) throw new Error(`No manifest entry for ${path.basename(sourceFile)}`);

function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function sourceCollegeName(name) {
  return String(name ?? '').split(/\s+-\s*|-(?=[A-Z])/)[0].trim();
}

function parseEnvValue(file, key) {
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const parsed = await parsePdf(sourceFile, { sourceYear: sourceEntry.year });
  const sourceRows = parsed.rows;
  const cells = sourceRows.flatMap((row) => row.cells.map((cell) => ({ ...cell, row })));
  const sourceColleges = [...new Map(sourceRows.map((row) => [row.collegeCode, {
    code: row.collegeCode, name: row.collegeName, baseName: sourceCollegeName(row.collegeName),
  }])).values()];
  const sourceBranches = parsed.branchNames.map(({ code, name }) => ({ code, name }));
  const report = {
    source: { file: path.basename(sourceFile), url: sourceEntry.url, year: sourceEntry.year, round: sourceEntry.round, phase: sourceEntry.phase ?? null, pages: parsed.pageCount },
    extraction: {
      sourceCollegeSeatRows: sourceRows.length,
      populatedRankCells: cells.length,
      rejectedRankCells: parsed.rejectedRankSamples.length,
      uniqueSourceCollegeCodes: sourceColleges.length,
      uniqueSourceCollegeBranchPairs: new Set(cells.map(({ row, branchCode }) => `${row.collegeCode}|${branchCode}|${row.seatType}`)).size,
      sourceSeatTypes: [...new Set(sourceRows.map((row) => row.seatType))].sort(),
      rankRange: { min: Math.min(...cells.map((cell) => cell.closingRank)), max: Math.max(...cells.map((cell) => cell.closingRank)) },
      rejectedCells: parsed.rejectedRankSamples,
    },
    database: { connected: false, collegeCount: null, collegeMappings: null, branchMappings: null },
  };
  const priorAuditRankCellCount = sourceEntry.extraction?.unmappedRankCells;
  if (Number.isInteger(priorAuditRankCellCount)) {
    const currentlyAccountedRankCells = cells.length + parsed.rejectedRankSamples.length;
    report.extraction.priorAuditRankCellCount = priorAuditRankCellCount;
    report.extraction.currentlyAccountedRankCells = currentlyAccountedRankCells;
    report.extraction.unaccountedAgainstPriorAudit = Math.max(0, priorAuditRankCellCount - currentlyAccountedRankCells);
  }

  const uri = parseEnvValue(path.join(root, '.env'), 'MONGO_URI');
  if (!uri) {
    report.database.reason = 'MONGO_URI is not configured in apps/api/.env';
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const documents = await mongoose.connection.db.collection('colleges').find({}, {
      projection: { collegeId: 1, name: 1, aliasNames: 1, alternateAdmissionCodes: 1, courses: 1 },
    }).toArray();
    report.database.connected = true;
    report.database.collegeCount = documents.length;

    report.database.collegeMappings = sourceColleges.map((source) => {
      const codeCandidates = documents.filter((doc) => (doc.alternateAdmissionCodes ?? []).some((entry) =>
        String(entry.code ?? '').toUpperCase() === source.code && String(entry.examBody ?? '').toUpperCase().includes('COMEDK')));
      const exactNameCandidates = documents.flatMap((doc) => {
        const base = normalize(source.baseName);
        const full = normalize(source.name);
        if ([normalize(doc.name)].includes(base) || normalize(doc.name) === full) return [{ doc, matchKind: 'exact_college_name' }];
        if ((doc.aliasNames ?? []).some((alias) => [base, full].includes(normalize(alias)))) return [{ doc, matchKind: 'exact_alias' }];
        return [];
      });
      let status = 'unmatched';
      let candidates = [];
      if (codeCandidates.length === 1) {
        const corroborated = exactNameCandidates.some((candidate) => String(candidate.doc._id) === String(codeCandidates[0]._id));
        status = corroborated ? 'exact_code_and_name' : 'official_code_name_conflict_review';
        candidates = codeCandidates;
      } else if (codeCandidates.length > 1) {
        status = 'ambiguous_official_code'; candidates = codeCandidates;
      } else if (exactNameCandidates.length === 1) {
        status = exactNameCandidates[0].matchKind; candidates = [exactNameCandidates[0].doc];
      } else if (exactNameCandidates.length > 1) {
        status = 'ambiguous_exact_name'; candidates = exactNameCandidates.map((match) => match.doc);
      }
      return {
        sourceCode: source.code,
        sourceName: source.name,
        baseNameCompared: source.baseName,
        status,
        candidates: candidates.map((doc) => ({ id: String(doc._id), collegeId: doc.collegeId, name: doc.name })),
      };
    });

    const safeCollegeBySourceCode = new Map(report.database.collegeMappings
      .filter((item) => ['exact_name_or_alias', 'exact_college_name', 'exact_alias', 'exact_code_and_name'].includes(item.status))
      .map((item) => [item.sourceCode, item.candidates[0]]));
    report.database.branchMappings = sourceBranches.map((source) => {
      const codeMatches = documents.flatMap((doc) => (doc.courses ?? [])
        .filter((course) => String(course.courseId ?? '').trim().toUpperCase() === source.code)
        .map((course) => ({ collegeId: doc.collegeId, courseId: course.courseId, courseName: course.name })));
      const exactNameMatches = documents.flatMap((doc) => (doc.courses ?? [])
        .filter((course) => normalize(course.name) === normalize(source.name))
        .map((course) => ({ collegeId: doc.collegeId, courseId: course.courseId, courseName: course.name })));
      const status = codeMatches.length === 1 ? 'exact_local_course_id'
        : codeMatches.length > 1 ? 'ambiguous_local_course_id'
          : exactNameMatches.length === 1 ? 'exact_branch_name'
            : exactNameMatches.length > 1 ? 'ambiguous_exact_branch_name' : 'unmatched';
      return {
        sourceCode: source.code,
        sourceName: source.name,
        sourcePairCount: cells.filter((cell) => cell.branchCode === source.code).length,
        matchedLocalCourseIdCount: codeMatches.length,
        exactLocalCourseNameCount: exactNameMatches.length,
        structuredAliasFieldAvailable: false,
        candidateExamples: (codeMatches.length ? codeMatches : exactNameMatches).slice(0, 5),
        status,
        identityForImport: 'COMEDK source branch code (stored in courseId and metadata)',
      };
    });
    report.database.branchMappingCounts = report.database.branchMappings.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {});

    report.database.collegeBranchMappingCounts = report.database.collegeMappings.reduce((counts, college) => {
      const local = safeCollegeBySourceCode.get(college.sourceCode);
      for (const { branchCode } of cells.filter((cell) => cell.row.collegeCode === college.sourceCode)) {
        const key = local ? 'college_exact_branch_code_retained' : 'unresolved_college';
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    }, {});

    report.database.collegeMappingCounts = report.database.collegeMappings.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {});
  } catch (error) {
    report.database.reason = `${error.name}: ${String(error.message).split('\n')[0].slice(0, 200)}`;
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }

  const sourceStem = path.basename(sourceFile, path.extname(sourceFile));
  const reportPath = path.join(root, 'data/comedk-sources', `${sourceStem}-mapping-report.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, source: report.source, extraction: report.extraction, database: {
    connected: report.database.connected,
    collegeCount: report.database.collegeCount,
    collegeMappingCounts: report.database.collegeMappingCounts,
    branchMappingCounts: report.database.branchMappingCounts,
    collegeBranchMappingCounts: report.database.collegeBranchMappingCounts,
    reason: report.database.reason,
  } }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
