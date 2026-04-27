const JobLock = require('../models/JobLock');

const acquireJobLock = async ({ name, ttlMs, owner }) => {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  const lock = await JobLock.findOneAndUpdate(
    {
      name,
      $or: [
        { lockedUntil: { $lte: now } },
        { lockedUntil: { $exists: false } }
      ]
    },
    {
      $set: {
        lockedUntil,
        owner,
        lastStartedAt: now,
        lastStatus: 'running',
        lastError: undefined
      },
      $setOnInsert: {
        name
      }
    },
    { new: true, upsert: true }
  );

  return lock.owner === owner ? lock : null;
};

const releaseJobLock = async ({ name, owner, status = 'success', error }) => {
  await JobLock.updateOne(
    { name, owner },
    {
      $set: {
        lockedUntil: new Date(),
        lastFinishedAt: new Date(),
        lastStatus: status,
        lastError: error ? String(error).slice(0, 1000) : undefined
      }
    }
  );
};

module.exports = {
  acquireJobLock,
  releaseJobLock,
};
