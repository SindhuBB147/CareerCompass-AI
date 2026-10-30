const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/career-compass-dev');
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));
  const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

  const colleges = await College.find({ isVerified: true, 'courses.examsAccepted': 'KCET' }).lean();
  console.log('Total colleges accepting KCET:', colleges.length);

  let totalMatches = 0;
  let matchesWithCutoffs = 0;
  let sampleMatches = [];

  for (const college of colleges) {
    for (const course of college.courses || []) {
      const name = (course.name || '').toLowerCase();
      if (name.includes('computer science')) {
        totalMatches++;
        const collegeMongoId = college._id.toString();
        const collegeCode = college.collegeId;

        const cutoffsExact = await Cutoff.find({
          collegeId: collegeMongoId,
          courseId: course.courseId,
          examCode: 'KCET',
          category: 'GM'
        }).lean();

        const collegeIdQueries = [{ collegeId: collegeMongoId }];
        if (collegeCode) collegeIdQueries.push({ collegeId: collegeCode });

        const cutoffsForCol = await Cutoff.find({
          $or: collegeIdQueries,
          examCode: 'KCET',
          category: 'GM'
        }).lean();

        if (sampleMatches.length < 5) {
          sampleMatches.push({
            collegeName: college.name,
            collegeId: collegeMongoId,
            collegeCode,
            courseId: course.courseId,
            courseName: course.name,
            cutoffsExactCount: cutoffsExact.length,
            totalCutoffsForCol: cutoffsForCol.length,
            courseIdsInCutoffs: [...new Set(cutoffsForCol.map(c => c.courseId))].slice(0, 5),
            courseNamesInCutoffs: [...new Set(cutoffsForCol.map(c => c.courseName))].slice(0, 5)
          });
        }

        if (cutoffsExact.length > 0) {
          matchesWithCutoffs++;
        }
      }
    }
  }

  console.log('Total CSE matches:', totalMatches);
  console.log('Matches with cutoffs found by exact (college.id, course.courseId):', matchesWithCutoffs);
  console.log('Sample matches:', JSON.stringify(sampleMatches, null, 2));

  await mongoose.disconnect();
}

test().catch(console.error);
