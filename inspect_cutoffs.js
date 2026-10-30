const mongoose = require('mongoose');

(async () => {
  // Resolve MongoDB URI – env var first, then try local, then in-memory fallback.
  let uri = process.env.MONGO_URI;
  if (!uri) {
    const localUri = 'mongodb://localhost:27017/career-compass-dev';
    try {
      await mongoose.connect(localUri, { dbName: 'career-compass-dev' });
      console.log('Connected to local MongoDB');
    } catch {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create({ instance: { dbName: 'career-compass-dev' } });
      uri = mongod.getUri();
      await mongoose.connect(uri, { dbName: 'career-compass-dev' });
      console.log('Started in-memory MongoDB');
    }
  } else {
    await mongoose.connect(uri, { dbName: 'career-compass-dev' });
    console.log('Connected using MONGO_URI');
  }

  // Ensure connection is ready (if not already established above)
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { dbName: 'career-compass-dev' });
  }

  const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

  const total = await Cutoff.countDocuments();
  console.log('Total cutoff records:', total);

  const sample = await Cutoff.find({ examCode: 'KCET', category: 'GM' }).limit(5).lean();
  console.log('Sample KCET GM records:', sample);

  const years = await Cutoff.distinct('year', { examCode: 'KCET', category: 'GM' });
  console.log('Years for KCET GM:', years);

  const courses = await Cutoff.distinct('courseId', { examCode: 'KCET', category: 'GM' });
  console.log('Distinct courseIds for KCET GM (first 10):', courses.slice(0, 10));

  const colleges = await Cutoff.distinct('collegeId', { examCode: 'KCET', category: 'GM' });
  console.log('Distinct collegeIds (first 10):', colleges.slice(0, 10));

  await mongoose.disconnect();
})();

// Resolve MongoDB URI – same logic as DatabaseModule (env var or fallback to local instance)
let uri = process.env.MONGO_URI;
if (!uri) {
  // Quick check for a running local MongoDB instance
  const net = require('net');
  const isLocalMongoUp = (() => {
    try {
      const socket = net.createConnection({ host: '127.0.0.1', port: 27017, timeout: 500 });
      socket.on('error', () => {});
      // If connection succeeds synchronously (unlikely), we treat as up.
      return true;
    } catch {
      return false;
    }
  })();
  if (isLocalMongoUp) {
    uri = 'mongodb://localhost:27017/career-compass-dev';
  } else {
    // Use in‑memory MongoDB (mongodb-memory-server) as a safe fallback for read‑only diagnostics.
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = new MongoMemoryServer({ instance: { dbName: 'career-compass-dev' } });
    uri = (await mongod.getUri()).replace('127.0.0.1', 'localhost');
  }
}

(async () => {
  try {
    await mongoose.connect(uri, { dbName: 'career-compass-dev' });
    // Minimal schema – we only need to query, so allow any fields.
    const Cutoff = mongoose.model('Cutoff', new mongoose.Schema({}, { strict: false, collection: 'cutoffs' }));

    const total = await Cutoff.countDocuments();
    console.log('Total cutoff records:', total);

    const sample = await Cutoff.find({ examCode: 'KCET', category: 'GM' }).limit(5).lean();
    console.log('Sample KCET GM records:', sample);

    const years = await Cutoff.distinct('year', { examCode: 'KCET', category: 'GM' });
    console.log('Years for KCET GM:', years);

    const courses = await Cutoff.distinct('courseId', { examCode: 'KCET', category: 'GM' });
    console.log('Distinct courseIds for KCET GM (first 10):', courses.slice(0, 10));

    const colleges = await Cutoff.distinct('collegeId', { examCode: 'KCET', category: 'GM' });
    console.log('Distinct collegeIds (first 10):', colleges.slice(0, 10));
  } catch (err) {
    console.error('Error during diagnostics:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
