const VoteAutoProcessor = require('../handler/auto_vote/utils/vote_auto_processor');

/**
 * Scans for votes and handles expired ones (24h auto-approve, 48h auto-reject)
 * @param {import('discord.js').Client} client - The Discord client
 */
async function scanAndAutoApproveVotes(client) {
  const processor = new VoteAutoProcessor();
  await processor.scanAndProcessExpiredVotes(client);
}

module.exports = {
  scanAndAutoApproveVotes
};