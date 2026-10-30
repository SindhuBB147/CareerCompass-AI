const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/career-compass-dev');
  console.log('Database name:', mongoose.connection.db.databaseName);

  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));
  const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

  const collegeCount = await College.countDocuments();
  const cutoffCount = await Cutoff.countDocuments();
  console.log('College count:', collegeCount);
  console.log('Cutoff count:', cutoffCount);

  const kcetCount = await Cutoff.countDocuments({ examCode: 'KCET' });
  console.log('KCET cutoffs count:', kcetCount);

  // Counts by year
  const years = await Cutoff.aggregate([
    { $match: { examCode: 'KCET' } },
    { $group: { _id: '$year', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  console.log('KCET cutoffs by year:', JSON.stringify(years));

  // Counts by round
  const rounds = await Cutoff.aggregate([
    { $match: { examCode: 'KCET' } },
    { $group: { _id: '$round', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  console.log('KCET cutoffs by round:', JSON.stringify(rounds));

  // Top categories
  const categories = await Cutoff.aggregate([
    { $match: { examCode: 'KCET' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 }
  ]);
  console.log('KCET cutoffs top categories:', JSON.stringify(categories));

  // Sample document
  const sample = await Cutoff.findOne({ examCode: 'KCET', category: 'GM' }).lean();
  console.log('Sample KCET GM document:', JSON.stringify(sample, null, 2));

  // Check if sample.collegeId resolves to actual College
  let collegeById = null;
  try {
    collegeById = await College.findOne({ _id: new mongoose.Types.ObjectId(sample.collegeId) }).lean();
  } catch (e) {
    collegeById = await College.findOne({ _id: sample.collegeId }).lean();
  }
  const collegeByCollegeId = await College.findOne({ collegeId: sample.collegeId }).lean();
  const collegeByCode = await College.findOne({ code: sample.collegeId }).lean();
  console.log('College found by _id:', collegeById ? collegeById.name : 'null');
  console.log('College found by collegeId:', collegeByCollegeId ? collegeByCollegeId.name : 'null');
  console.log('College found by code:', collegeByCode ? collegeByCode.name : 'null');

  // Check if courseId exists in college.courses
  const actualCollege = collegeById || collegeByCollegeId || collegeByCode;
  if (actualCollege && actualCollege.courses) {
    const courseMatch = actualCollege.courses.find(c => c.courseId === sample.courseId);
    console.log('Course in college matching courseId (' + sample.courseId + '):', courseMatch ? courseMatch.name : 'not found');
  }

  // Check rank types
  const nonNumericRank = await Cutoff.countDocuments({
    examCode: 'KCET',
    closingRank: { $not: { $type: 'number' } }
  });
  console.log('Non-numeric closingRank count:', nonNumericRank);

  await mongoose.disconnect();
}

run().catch(console.error);
