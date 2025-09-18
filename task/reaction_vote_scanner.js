const { ChannelType } = require('discord.js');
const { config } = require('../config/config');
const { initializeVoteFile } = require('../handler/reaction_vote_system/reaction_vote_manager');

async function scanActiveThreads(client) {
    console.log('[ReactionVoteScanner] Starting scan of active threads...');
    const postReactionConfig = config.get('post_reaction_autoapply.post_reaction_autoapply');
    if (!postReactionConfig) {
        console.log('[ReactionVoteScanner] No post reaction config found.');
        return;
    }

    for (const configId in postReactionConfig) {
        const configData = postReactionConfig[configId];
        const guild = await client.guilds.fetch(configData.guilds_id);
        if (!guild) continue;

        const channel = await guild.channels.fetch(configData.data.channle_id);
        if (!channel || channel.type !== ChannelType.GuildForum) continue;

        const activeThreads = await channel.threads.fetchActive();
        for (const thread of activeThreads.threads.values()) {
            // Check if the thread is in the whitelist
            if (configData.data.whitelist_post && configData.data.whitelist_post.includes(thread.id)) {
                continue;
            }
            await initializeVoteFile(thread);
        }
    }
    console.log('[ReactionVoteScanner] Finished scan of active threads.');
}

module.exports = {
    scanActiveThreads
};