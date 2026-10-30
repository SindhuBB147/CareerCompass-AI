const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/career-compass-dev');
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));

  const res = await College.aggregate([
    { $unwind: '$courses' },
    { $unwind: '$courses.examsAccepted' },
    { $group: { _id: '$courses.examsAccepted', count: { $sum: 1 } } }
  ]);
  console.log('Exams accepted distinct values in DB:', res);
  await mongoose.disconnect();
}
run();
