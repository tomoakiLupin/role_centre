const fs = require('fs/promises');
const path = require('path');

const rejectionsFilePath = path.join(__dirname, '..', 'data', 'rejections.json');

// Helper to ensure the rejections file exists
async function ensureRejectionsFile() {
  try {
    await fs.access(rejectionsFilePath);
  } catch (error) {
    await fs.writeFile(rejectionsFilePath, JSON.stringify({}, null, 2));
  }
}

// Helper to read the rejections data
async function getRejections() {
  await ensureRejectionsFile();
  const data = await fs.readFile(rejectionsFilePath, 'utf8');
  return JSON.parse(data);
}

// Helper to save the rejections data
async function saveRejections(data) {
  await ensureRejectionsFile();
  await fs.writeFile(rejectionsFilePath, JSON.stringify(data, null, 2));
}

/**
 * Adds a permanent rejection for a user for a specific role.
 * @param {string} userId - The ID of the user to reject.
 * @param {string} roleId - The ID of the role the user is rejected from.
 */
async function addPermanentRejection(userId, roleId) {
  const rejections = await getRejections();
  if (!rejections[roleId]) {
    rejections[roleId] = {};
  }
  rejections[roleId][userId] = { type: 'permanent' };
  await saveRejections(rejections);
  console.log(`[rejectionManager] Added permanent rejection for user ${userId} from role ${roleId}`);
}

/**
 * Adds a temporary rejection for a user for a specific role.
 * @param {string} userId - The ID of the user to reject.
 * @param {string} roleId - The ID of the role the user is rejected from.
 * @param {number} hours - The duration of the rejection in hours.
 */
async function addTemporaryRejection(userId, roleId, hours) {
  const rejections = await getRejections();
  if (!rejections[roleId]) {
    rejections[roleId] = {};
  }
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  rejections[roleId][userId] = { type: 'temporary', expiry: expiry.toISOString() };
  await saveRejections(rejections);
  console.log(`[rejectionManager] Added temporary rejection for user ${userId} from role ${roleId} for ${hours} hours, until ${expiry.toISOString()}`);
}

/**
 * Checks if a user is currently rejected from applying for a specific role.
 * @param {string} userId - The ID of the user to check.
 * @param {string} roleId - The ID of the role to check.
 * @returns {Promise<{rejected: boolean, rejection: object|null}>} - An object indicating if the user is rejected and the rejection details.
 */
async function isRejected(userId, roleId) {
  const rejections = await getRejections();
  const roleRejections = rejections[roleId];

  if (!roleRejections || !roleRejections[userId]) {
    return { rejected: false, rejection: null };
  }

  const rejection = roleRejections[userId];

  if (rejection.type === 'permanent') {
    return { rejected: true, rejection: rejection };
  }

  if (rejection.type === 'temporary') {
    const now = new Date();
    const expiry = new Date(rejection.expiry);
    if (now < expiry) {
      return { rejected: true, rejection: rejection };
    } else {
      // Clean up expired temporary rejection
      delete roleRejections[userId];
      await saveRejections(rejections);
      return { rejected: false, rejection: null };
    }
  }

  return { rejected: false, rejection: null };
}

module.exports = {
  addPermanentRejection,
  addTemporaryRejection,
  isRejected,
};