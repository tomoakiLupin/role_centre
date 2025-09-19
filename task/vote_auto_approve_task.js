const fs = require('fs/promises');
const path = require('path');
const voteManager = require('../handler/vote_system/vote_manager');

const votesDirPath = path.join(__dirname, '..', 'data', 'votes');

/**
 * Scans for votes and handles expired ones (24h auto-approve, 48h auto-reject)
 * @param {import('discord.js').Client} client - The Discord client
 */
async function scanAndAutoApproveVotes(client) {
  try {
    // Ensure votes directory exists
    try {
      await fs.access(votesDirPath);
    } catch (error) {
      console.log('[voteAutoApprove] Votes directory does not exist, skipping scan.');
      return;
    }

    const files = await fs.readdir(votesDirPath);
    const now = new Date();
    let processedCount = 0;

    for (const file of files) {
      if (path.extname(file) === '.json') {
        const voteId = path.basename(file, '.json');
        try {
          const voteData = await voteManager.getVote(voteId);

          if (voteData && ['pending', 'pending_admin'].includes(voteData.status)) {
            // Parse vote creation time from voteId format: roleId-timestamp-userId
            const voteIdParts = voteId.split('-');
            if (voteIdParts.length >= 2) {
              const creationTime = new Date(parseInt(voteIdParts[1]));
              const timeSinceCreation = now - creationTime;

              // 48 hours = 48 * 60 * 60 * 1000 ms
              const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
              // 24 hours = 24 * 60 * 60 * 1000 ms
              const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

              // If 48 hours have passed since creation, auto-reject
              if (timeSinceCreation >= FORTY_EIGHT_HOURS) {
                console.log(`[voteAutoApprove] Auto-rejecting vote after 48h: ${voteId}`);
                await voteManager.finalizeVote(client, voteId, 'rejected', false);
                processedCount++;
              }
              // If vote is in pending_admin status and 24 hours have passed since entering that status
              else if (voteData.status === 'pending_admin' && voteData.pendingUntil) {
                const pendingUntil = new Date(voteData.pendingUntil);

                // If 24 hours have passed since entering pending_admin, auto-approve
                if (now >= pendingUntil) {
                  console.log(`[voteAutoApprove] Auto-approving vote after 24h admin period: ${voteId}`);
                  await voteManager.finalizeVote(client, voteId, 'approved');
                  processedCount++;
                }
              }
            }
          }
        } catch (error) {
          console.error(`[voteAutoApprove] Error processing vote file ${file}:`, error);
        }
      }
    }

    if (processedCount > 0) {
      console.log(`[voteAutoApprove] Processed ${processedCount} expired votes.`);
    }
  } catch (error) {
    console.error('[voteAutoApprove] Error during vote auto-approval scan:', error);
  }
}

module.exports = {
  scanAndAutoApproveVotes
};