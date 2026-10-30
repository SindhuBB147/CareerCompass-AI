import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/career-compass-dev';

async function seedAdmin() {
  console.log(`Connecting to MongoDB at: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);

  const email = 'mriranna21@gmail.com';
  const password = 'Irannatiralapur21@';
  const fullName = 'Iranna Tiralapur';
  const role = 'super_admin';

  const passwordHash = await bcrypt.hash(password, 12);
  const adminUsersColl = mongoose.connection.collection('adminusers');

  const result = await adminUsersColl.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        name: fullName,
        email: email.toLowerCase(),
        passwordHash,
        role,
        permissions: [
          'admins:manage',
          'colleges:delete',
          'cutoffs:resolve',
          'security:manage',
          'sessions:force_logout',
          'accounts:lock_unlock',
          'audit:view',
          'ai_config:manage',
          'students:delete',
          'scholarships:delete',
        ],
        isActive: true,
        twoFactorEnabled: false,
        twoFactorMethod: null,
        twoFactorTrustedDeviceFingerprints: [],
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        sessions: [],
        passwordHistory: [],
      },
    },
    { upsert: true }
  );

  console.log(`Successfully seeded/updated super_admin account!`);
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     ${role}`);
  console.log(`Matched:  ${result.matchedCount}, Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error('Failed to seed admin account:', err);
  process.exit(1);
});
