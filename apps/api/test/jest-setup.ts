import { afterEach } from '@jest/globals';
import * as fs from 'fs';
import mongoose from 'mongoose';
process.env.MONGOMS_TIMEOUT_MS = '600000'; // increase timeout to allow binary download (~10 minutes)

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});
