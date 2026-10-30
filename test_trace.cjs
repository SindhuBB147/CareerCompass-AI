const mongoose = require('mongoose');

// Replicate PredictionEngineService exact logic
function computeTrendingClosingRank(data) {
  if (data.length === 0) return 0;
  if (data.length === 1) return data[0].closingRank;
  const sorted = [...data].sort((a, b) => b.year - a.year);
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < sorted.length; i++) {
    const weight = i === 0 ? 3 : i === 1 ? 2 : 1;
    weightedSum += sorted[i].closingRank * weight;
    totalWeight += weight;
  }
  return Math.round(weightedSum / totalWeight);
}

function probabilityPercentFromRatio(ratio) {
  let percent;
  if (ratio <= 0.55) percent = 90 + Math.min(9, (0.55 - ratio) * 20);
  else if (ratio <= 0.8) percent = 70 + ((0.8 - ratio) / 0.25) * 20;
  else if (ratio <= 1.0) percent = 40 + ((1.0 - ratio) / 0.2) * 30;
  else if (ratio <= 1.25) percent = 10 + ((1.25 - ratio) / 0.25) * 30;
  else percent = Math.max(1, 10 - (ratio - 1.25) * 15);
  return Math.round(Math.min(99, Math.max(1, percent)));
}

function bandFromPercent(percent) {
  if (percent >= 90) return 'Very High';
  if (percent >= 70) return 'High';
  if (percent >= 40) return 'Medium';
  if (percent >= 10) return 'Low';
  return 'Very Low';
}

function confidenceFromDataPoints(dataPoints) {
  return dataPoints >= 3 ? 'high' : dataPoints >= 2 ? 'medium' : 'low';
}

async function testTrace() {
  await mongoose.connect('mongodb://localhost:27017/career-compass-dev');
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));
  const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

  const colleges = await College.find({ isVerified: true, 'courses.examsAccepted': 'KCET' }).lean();

  const rank = 33000;
  const category = 'GM';
  const examCode = 'KCET';
  const selectedCourseLabel = 'Computer Science & Engineering (CSE)';

  // Course matching
  const results = [];
  for (const college of colleges) {
    for (const course of college.courses || []) {
      const nameLower = (course.name || '').toLowerCase();
      if (!nameLower.includes('computer science')) continue;

      const trend = await Cutoff.find({
        collegeId: college._id.toString(),
        courseId: course.courseId,
        examCode,
        category,
        status: { $nin: ['archived', 'invalid'] }
      }).sort({ year: 1, round: 1 }).lean();

      const trendData = trend.map((t) => ({ year: t.year, closingRank: t.closingRank }));
      const trendingClosingRank = computeTrendingClosingRank(trendData);

      const cutoffs = trendData.map(c => c.closingRank);
      let rankPosition;
      if (cutoffs.length === 0) {
        rankPosition = 'InsufficientData';
      } else {
        const bestCutoff = Math.min(...cutoffs);
        const worstCutoff = Math.max(...cutoffs);
        if (rank < bestCutoff) rankPosition = 'BetterThanBest';
        else if (rank === bestCutoff) rankPosition = 'EqualToBest';
        else if (rank > worstCutoff) rankPosition = 'WorseThanWorst';
        else rankPosition = 'Between';
      }

      let basePercent;
      if (rankPosition === 'WorseThanWorst' || rankPosition === 'InsufficientData') {
        basePercent = 3;
      } else {
        const ratio = trendingClosingRank > 0 ? rank / trendingClosingRank : Infinity;
        basePercent = trendingClosingRank > 0 ? probabilityPercentFromRatio(ratio) : 3;
      }

      const finalPercent = Math.min(99, Math.max(1, basePercent));
      const band = bandFromPercent(finalPercent);
      const confidence = confidenceFromDataPoints(trendData.length);
      const mostRecent = [...trend].sort((a, b) => b.year - a.year)[0];

      results.push({
        collegeId: college._id.toString(),
        collegeName: college.name,
        nirfRank: college.accreditation?.nirfRank ?? null,
        discipline: course.discipline || 'Engineering',
        courseId: course.courseId,
        courseName: course.name,
        probabilityPercent: finalPercent,
        probabilityLevel: band,
        previousYearCutoff: mostRecent?.closingRank ?? null,
        expectedClosingRank: trendingClosingRank > 0 ? trendingClosingRank : null,
        feePerYear: course.feePerYear ?? college.feeBreakdown?.totalAnnualFee ?? null,
        placementAverage: college.placementSummary?.[0]?.averagePackage ?? null,
        city: college.city,
        dataStatus: rankPosition === 'InsufficientData' ? 'insufficient' : 'complete',
        rankPosition,
        cutoffs
      });
    }
  }

  // Sorting as in prediction-engine.service.ts
  const studentRank = rank;
  const getProb = (p) => (typeof p === 'number' && !isNaN(p) ? p : 0);
  const getNirf = (r) => (typeof r === 'number' && !isNaN(r) && r > 0 ? r : 999999);
  const getDist = (expectedClosingRank) =>
    typeof expectedClosingRank === 'number' && !isNaN(expectedClosingRank) && expectedClosingRank > 0
      ? Math.abs(studentRank - expectedClosingRank)
      : 999999999;

  const sorted = [...results].sort((a, b) => {
    const nirfDiff = getNirf(a.nirfRank) - getNirf(b.nirfRank);
    if (nirfDiff !== 0) return nirfDiff;
    const probDiff = getProb(b.probabilityPercent) - getProb(a.probabilityPercent);
    if (probDiff !== 0) return probDiff;
    const distDiff = getDist(a.expectedClosingRank) - getDist(b.expectedClosingRank);
    if (distDiff !== 0) return distDiff;
    return (a.collegeName || '').localeCompare(b.collegeName || '');
  });

  console.log('Top 10 Page 1 results:');
  const page1 = sorted.slice(0, 10);
  page1.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.collegeName} (NIRF #${r.nirfRank}) - ${r.courseName}`);
    console.log(`   Prob: ${r.probabilityPercent}%, Level: ${r.probabilityLevel}, Expected: ${r.expectedClosingRank}, Cutoffs: ${JSON.stringify(r.cutoffs)}, Status: ${r.dataStatus}, Position: ${r.rankPosition}`);
  });

  await mongoose.disconnect();
}

testTrace().catch(console.error);
