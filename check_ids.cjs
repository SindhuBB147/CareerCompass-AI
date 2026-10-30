const mongoose = require('mongoose');

async function checkCutoffs() {
  await mongoose.connect('mongodb://localhost:27017/career-compass-dev');
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));
  const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

  const colleges = await College.find({ isVerified: true, 'courses.examsAccepted': 'KCET' }).lean();

  let matchedByMongoId = 0;
  let matchedByCode = 0;
  let unmatchedColleges = 0;

  for (const c of colleges) {
    const mongoId = c._id.toString();
    const code = c.collegeId;

    const countMongoId = await Cutoff.countDocuments({ collegeId: mongoId, examCode: 'KCET' });
    const countCode = code ? await Cutoff.countDocuments({ collegeId: code, examCode: 'KCET' }) : 0;

    if (countMongoId > 0) matchedByMongoId++;
    if (countCode > 0) matchedByCode++;
    if (countMongoId === 0 && countCode === 0) unmatchedColleges++;
  }

  console.log(`Colleges with KCET courses: ${colleges.length}`);
  console.log(`Colleges having cutoffs by _id: ${matchedByMongoId}`);
  console.log(`Colleges having cutoffs by code: ${matchedByCode}`);
  console.log(`Colleges with NO cutoffs under either: ${unmatchedColleges}`);

  await mongoose.disconnect();
}

checkCutoffs().catch(console.error);
