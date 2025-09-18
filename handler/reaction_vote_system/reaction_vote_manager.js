const fs = require('fs/promises');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { config } = require('../../config/config');
const { sendLog } = require('../../utils/logger');

const voteDataDir = path.join(__dirname, '..', '..', 'data', 'reaction_vote');

async function ensureVoteDataDir() {
    try {
        await fs.access(voteDataDir);
    } catch (error) {
        await fs.mkdir(voteDataDir, { recursive: true });
    }
}

function getVoteFilePath(threadId) {
    if (/[\\/]/.test(threadId)) {
        throw new Error('Invalid threadId format');
    }
    return path.join(voteDataDir, `${threadId}.json`);
}

async function getVoteData(threadId) {
    await ensureVoteDataDir();
    const filePath = getVoteFilePath(threadId);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

async function saveVoteData(threadId, data) {
    await ensureVoteDataDir();
    const filePath = getVoteFilePath(threadId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function getReactionVoteConfig(channelId) {
    const postReactionConfig = config.get('post_reaction_autoapply.post_reaction_autoapply');
    if (!postReactionConfig) return null;

    return Object.values(postReactionConfig).find(c => c.data.channle_id === channelId);
}

async function handleReaction(client, reaction, user, action) {
    console.log(`[handleReaction] Received reaction ${action} from ${user.tag} in thread ${reaction.message.channel.id}`);
    const message = reaction.message;
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    const thread = message.channel;
    const configData = getReactionVoteConfig(thread.parentId);

    if (!configData) {
        console.log(`[handleReaction] No config found for channel ${thread.parentId}`);
        return;
    }
    if (reaction.emoji.name !== configData.data.emoji_id) {
        console.log(`[handleReaction] Emoji ${reaction.emoji.name} does not match config emoji ${configData.data.emoji_id}`);
        return;
    }
    console.log(`[handleReaction] Found config for channel ${thread.parentId}`);

    const guild = await client.guilds.fetch(configData.guilds_id);
    const member = await guild.members.fetch(user.id);

    // Only check for role on 'add' action
    if (action === 'add' && !member.roles.cache.has(configData.data.vote_allow_roleid)) {
        console.log(`[handleReaction] User ${user.tag} does not have the required role to vote.`);
        // If the user is not allowed to vote, remove their reaction.
        try {
            await reaction.users.remove(user.id);
        } catch (error) {
            console.error(`[handleReaction] Failed to remove reaction for user ${user.tag}:`, error);
        }
        return;
    }
    console.log(`[handleReaction] User ${user.tag} has permission for action: ${action}`);

    let voteData = await getVoteData(thread.id);
    if (!voteData) {
        voteData = {
            threadId: thread.id,
            voters: [],
            voteCount: 0
        };
    }

    if (action === 'add' && !voteData.voters.includes(user.id)) {
        voteData.voters.push(user.id);
    } else if (action === 'remove') {
        voteData.voters = voteData.voters.filter(voterId => voterId !== user.id);
    }

    voteData.voteCount = voteData.voters.length;
    await saveVoteData(thread.id, voteData);
    console.log(`[handleReaction] Updated vote data for thread ${thread.id}:`, voteData);

    // Update the status message
    await updateVoteStatusMessage(client, thread.id, voteData.voteCount, configData.data.threshold);

    if (voteData.voteCount >= configData.data.threshold) {
        await thread.setLocked(true, '投票达到阈值，帖子已锁定');
        await sendLog(client, 'info', {
            module: '帖子反应投票系统',
            operation: '帖子锁定',
            message: `帖子 ${thread.name} (${thread.id}) 因投票达到阈值 ${configData.data.threshold} 已被锁定。`
        });
    }
}

async function initializeVoteFile(thread) {
    const configData = getReactionVoteConfig(thread.parentId);
    if (!configData) return;

    // Check if the thread is in the whitelist
    if (configData.data.whitelist_post && configData.data.whitelist_post.includes(thread.id)) {
        return;
    }

    let voteData = await getVoteData(thread.id);
    if (!voteData) {
        const statusEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📊 投票状态')
            .setDescription(`该帖子的投票正在进行中...`)
            .addFields(
                { name: '当前票数', value: '0', inline: true },
                { name: '目标票数', value: `${configData.data.threshold}`, inline: true }
            )
            .setTimestamp();

        const statusMessage = await thread.send({ embeds: [statusEmbed] });

        voteData = {
            threadId: thread.id,
            voters: [],
            voteCount: 0,
            statusMessageId: statusMessage.id
        };
        await saveVoteData(thread.id, voteData);
        console.log(`Initialized vote file for thread: ${thread.id}`);
    }
}

async function updateVoteStatusMessage(client, threadId, currentVotes, threshold) {
    const voteData = await getVoteData(threadId);
    if (!voteData || !voteData.statusMessageId) return;

    try {
        const thread = await client.channels.fetch(threadId);
        const message = await thread.messages.fetch(voteData.statusMessageId);

        const newEmbed = new EmbedBuilder(message.embeds[0].toJSON())
            .setFields(
                { name: '当前票数', value: `${currentVotes}`, inline: true },
                { name: '目标票数', value: `${threshold}`, inline: true }
            );
        
        if (currentVotes >= threshold) {
            newEmbed.setColor(0x2ecc71).setDescription('投票已达到目标，帖子已锁定！');
        }

        await message.edit({ embeds: [newEmbed] });
    } catch (error) {
        console.error(`[updateVoteStatusMessage] Error updating status message for thread ${threadId}:`, error);
    }
}

module.exports = {
    handleReaction,
    initializeVoteFile
};