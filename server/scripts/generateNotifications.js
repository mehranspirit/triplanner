require('dotenv').config();

const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { acquireJobLock, releaseJobLock } = require('../services/jobLock');
const { generateScheduledNotifications } = require('../services/notificationJobs');

const JOB_NAME = 'generate-notifications';
const LOCK_TTL_MS = 10 * 60 * 1000;

const run = async () => {
  const owner = `${process.pid}-${randomUUID()}`;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const lock = await acquireJobLock({
    name: JOB_NAME,
    ttlMs: LOCK_TTL_MS,
    owner
  });

  if (!lock) {
    console.log('Notification generation already running; skipping.');
    return;
  }

  try {
    const result = await generateScheduledNotifications();
    console.log('Notification generation completed:', {
      tripCount: result.tripCount,
      userTripCount: result.userTripCount,
      generatedCount: result.generatedCount
    });
    await releaseJobLock({ name: JOB_NAME, owner, status: 'success' });
  } catch (error) {
    await releaseJobLock({ name: JOB_NAME, owner, status: 'failed', error });
    throw error;
  }
};

run()
  .catch((error) => {
    console.error('Notification generation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
