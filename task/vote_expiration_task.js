const { ChannelType } = require('discord.js');
const { config } = require('../config/config');
const { closeVoteForThread } = require('../handler/reaction_vote_system/reaction_vote_manager');
const { getVoteData } = require('../handler/reaction_vote_system/reaction_vote_manager');

async function checkExpiredVotes(client) {
    console.log('[VoteExpirationTask] Starting scan for expired votes...');
    const postReactionConfig = config.get('post_reaction_autoapply.post_reaction_autoapply');
    if (!postReactionConfig) {
        console.log('[VoteExpirationTask] No post reaction config found.');
        return;
    }

    const now = Math.floor(Date.now() / 1000);

    for (const configId in postReactionConfig) {
        const configData = postReactionConfig[configId];
        const endAt = configData.data.end_at ? parseInt(configData.data.end_at, 10) : null;

        if (!endAt || now < endAt) {
            continue;
        }

        console.log(`[VoteExpirationTask] Config ${configId} has expired. Closing associated votes.`);

        try {
            const guild = await client.guilds.fetch(configData.guilds_id);
            if (!guild) continue;

            const channel = await guild.channels.fetch(configData.data.channle_id);
            if (!channel || channel.type !== ChannelType.GuildForum) continue;

            const activeThreads = await channel.threads.fetchActive();
            for (const thread of activeThreads.threads.values()) {
                const voteData = await getVoteData(thread.id);
                if (voteData) {
                    await closeVoteForThread(client, thread, configData, '投票已到期');
                }
            }
        } catch (error) {
            console.error(`[VoteExpirationTask] Error processing expired votes for config ${configId}:`, error);
        }
    }
    console.log('[VoteExpirationTask] Finished scan for expired votes.');
}

module.exports = {
    checkExpiredVotes
};