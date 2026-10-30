const mongoose = require('mongoose');

// Import utilities or replicate exact PredictionEngine logic
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

async function run() {
  await mongoose.connect('mongodb://localhost:27017/career-compass-dev');
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));
  const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

  const colleges = await College.find({ isVerified: true, 'courses.examsAccepted': 'KCET' }).lean();

  const rank = 33000;
  const category = 'GM';
  const examCode = 'KCET';

  const results = [];

  for (const college of colleges) {
    for (const course of college.courses || []) {
      const name = (course.name || '').toLowerCase();
      if (!name.includes('computer science')) continue;

      // Current getTrend in PredictionEngineService:
      // this.cutoffService.getTrend(college.id, course.courseId, examCode, effectiveCategory)
      const trend = await Cutoff.find({
        collegeId: college._id.toString(),
        courseId: course.courseId,
        examCode: examCode.toUpperCase(),
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

      results.push({
        collegeName: college.name,
        courseName: course.name,
        courseId: course.courseId,
        trendCount: trend.length,
        trendCutoffs: cutoffs,
        trendingClosingRank,
        rankPosition,
        basePercent
      });
    }
  }

  console.log('Total evaluated course options:', results.length);
  const byPosition = {};
  results.forEach(r => {
    byPosition[r.rankPosition] = (byPosition[r.rankPosition] || 0) + 1;
  });
  console.log('Results by rankPosition:', byPosition);

  const byPercent = {};
  results.forEach(r => {
    byPercent[r.basePercent] = (byPercent[r.basePercent] || 0) + 1;
  });
  console.log('Results by basePercent:', byPercent);

  // Show top results if sorted by trendingClosingRank or probability
  const nonThree = results.filter(r => r.basePercent !== 3);
  console.log('Number of results where probability != 3%:', nonThree.length);
  if (nonThree.length > 0) {
    console.log('Sample non-3% results:', JSON.stringify(nonThree.slice(0, 5), null, 2));
  }

  // How are results sorted in PredictionEngineService?
  // Let's check how sortResults works!

  await mongoose.disconnect();
}

run().catch(console.error);
