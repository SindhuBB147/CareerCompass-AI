import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export async function globalSetup() {
  // increase timeout for binary download (5 minutes)
  process.env.MONGOMS_TIMEOUT_MS = '600000'; // increase timeout for binary download (~10 minutes)
  const uniqueDbName = `career-compass-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  // expose to tests via env variable
  process.env.MONGO_URI = uri;
  // store instance for teardown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).__MONGOD__ = mongod;
}

export async function globalTeardown() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mongodInstance = (global as any).__MONGOD__ as MongoMemoryServer;
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}
