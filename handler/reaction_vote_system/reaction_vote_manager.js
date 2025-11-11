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
    if (user.bot) return;
    // console.log(`[handleReaction] Received reaction ${action} from ${user.tag} in thread ${reaction.message.channel.id}`);
    const message = reaction.message;
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    const thread = message.channel;
    const configData = getReactionVoteConfig(thread.parentId);

    if (!configData) {
        // console.log(`[handleReaction] No config found for channel ${thread.parentId}`);
        return;
    }

    // const now = Math.floor(Date.now() / 1000);
    // const startAt = configData.data.start_at ? parseInt(configData.data.start_at, 10) : null;
    // const endAt = configData.data.end_at ? parseInt(configData.data.end_at, 10) : null;

    // if (startAt && now < startAt) {
    //     console.log(`[handleReaction] Voting has not started yet for config ${configData.config_id}.`);
    //     return;
    // }
    // if (endAt && now > endAt) {
    //     console.log(`[handleReaction] Voting has ended for config ${configData.config_id}.`);
    //     return;
    // }

    if (reaction.emoji.name !== configData.data.emoji_id) {
        // console.log(`[handleReaction] Emoji ${reaction.emoji.name} does not match config emoji ${configData.data.emoji_id}`);
        return;
    }
    console.log(`[handleReaction] Found config for channel ${thread.parentId}`);

    const guild = await client.guilds.fetch(configData.guilds_id);
    const member = await guild.members.fetch(user.id);

    // Only check for role on 'add' action
    if (action === 'add' && !member.roles.cache.has(configData.data.vote_allow_roleid)) {
        // console.log(`[handleReaction] User ${user.tag} does not have the required role to vote.`);
        // If the user is not allowed to vote, remove their reaction.
        if (configData.data.vote_type !== 'role_give') {
            try {
                await reaction.users.remove(user.id);
            } catch (error) {
                // console.error(`[handleReaction] Failed to remove reaction for user ${user.tag}:`, error);
            }
        }
        return;
    }
    // console.log(`[handleReaction] User ${user.tag} has permission for action: ${action}`);

    let voteData = await getVoteData(thread.id);
    if (!voteData) {
        voteData = {
            threadId: thread.id,
            voters: [],
            voteCount: 0
        };
    }

    // If status message doesn't exist, try to create it now.
    if (!voteData.statusMessageId) {
        try {
            const statusEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📊 投票状态')
                .setDescription('该帖子的投票正在进行中...')
                .addFields(
                    { name: '当前票数', value: `${voteData.voteCount}`, inline: true },
                    { name: '目标票数', value: `${configData.data.threshold}`, inline: true }
                )
                .setTimestamp();
            const statusMessage = await thread.send({ embeds: [statusEmbed] });
            voteData.statusMessageId = statusMessage.id;
            console.log(`[handleReaction] Created status message for thread ${thread.id}`);
        } catch (error) {
            console.error(`[handleReaction] Failed to create status message for thread ${thread.id}:`, error);
        }
    }

    const isVoter = voteData.voters.includes(user.id);

    if (action === 'add') {
        if (isVoter) {
            console.log(`[handleReaction] User ${user.tag} already voted.`);
            return;
        }
        voteData.voters.push(user.id);
    } else if (action === 'remove') {
        if (!isVoter) {
            console.log(`[handleReaction] User ${user.tag} was not a voter.`);
            return;
        }
        voteData.voters = voteData.voters.filter(voterId => voterId !== user.id);
    } else {
        return;
    }

    voteData.voteCount = voteData.voters.length;
    await saveVoteData(thread.id, voteData);
    console.log(`[handleReaction] Updated vote data for thread ${thread.id}:`, voteData);

    // Update the status message
    await updateVoteStatusMessage(client, thread.id, voteData.voteCount, configData.data.threshold, 'in_progress');

    if (voteData.voteCount >= configData.data.threshold) {
        const actionConfig = configData.data.action_config || { locking: true, archive: false };
        const actionDescription = [];

        if (actionConfig.locking) {
            await thread.setLocked(true, '投票达到阈值，帖子已锁定');
            actionDescription.push('锁定');
            await sendLog(client, 'info', {
                module: '帖子反应投票系统',
                operation: '帖子锁定',
                message: `帖子 ${thread.name} (${thread.id}) 因投票达到阈值 ${configData.data.threshold} 已被锁定。`
            });
        }

        if (actionConfig.archive) {
            await thread.setArchived(true, '投票达到阈值，帖子已归档');
            actionDescription.push('归档');
            await sendLog(client, 'info', {
                module: '帖子反应投票系统',
                operation: '帖子归档',
                message: `帖子 ${thread.name} (${thread.id}) 因投票达到阈值 ${configData.data.threshold} 已被归档。`
            });
        }

        let description = '投票已达到目标';
        if (actionDescription.length > 0) {
            description += `，帖子已${actionDescription.join('和')}！`;
        } else {
            description += '！';
        }
        await updateVoteStatusMessage(client, thread.id, voteData.voteCount, configData.data.threshold, 'completed', description);

        // 授予角色给帖子作者
        try {
            const ownerId = thread.ownerId;
            if (ownerId) {
                const owner = await guild.members.fetch(ownerId);
                const roleId = configData.give_role;
                if (owner && roleId) {
                    await owner.roles.add(roleId);
                    await sendLog(client, 'info', {
                        module: '帖子反应投票系统',
                        operation: '授予角色',
                        message: `已将角色 ${roleId} 授予用户 ${owner.user.tag} (${ownerId})。`
                    });
                }
            }
        } catch (error) {
            console.error(`[handleReaction] 授予角色时出错:`, error);
            await sendLog(client, 'error', {
                module: '帖子反应投票系统',
                operation: '授予角色失败',
                message: `为用户 ${thread.ownerId} 授予角色 ${configData.give_role} 时失败: ${error.message}`
            });
        }
    }
}

async function initializeVoteFile(thread) {
    const configData = getReactionVoteConfig(thread.parentId);
    if (!configData) return;

    // Check if the thread is in the whitelist
    if (configData.data.whitelist_post && configData.data.whitelist_post.includes(thread.id)) {
        return;
    }

    // const threadCreationTime = Math.floor(thread.createdTimestamp / 1000);
    // const startAt = configData.data.start_at ? parseInt(configData.data.start_at, 10) : null;
    // if (startAt && threadCreationTime < startAt) {
    //     console.log(`[initializeVoteFile] Thread ${thread.id} was created before the voting start time. Skipping initialization.`);
    //     return;
    // }

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

        try {
            const statusMessage = await thread.send({ embeds: [statusEmbed] });

            voteData = {
                threadId: thread.id,
                voters: [],
                voteCount: 0,
                statusMessageId: statusMessage.id
            };
            await saveVoteData(thread.id, voteData);
            console.log(`Initialized vote file for thread: ${thread.id}`);
        } catch (error) {
            if (error.code === 40058) {
                console.log(`[initializeVoteFile] Cannot send initial message to thread ${thread.id}. The author needs to send a message first. The status message will be created on the first interaction.`);
            } else {
                console.error(`[initializeVoteFile] Failed to send initial message to thread ${thread.id}:`, error);
            }
        }
    }
}

async function updateVoteStatusMessage(client, threadId, currentVotes, threshold, status = 'in_progress', reason = '') {
    const voteData = await getVoteData(threadId);
    if (!voteData || !voteData.statusMessageId) return;

    try {
        const thread = await client.channels.fetch(threadId);
        if (thread.archived) {
            console.log(`[updateVoteStatusMessage] Thread ${threadId} is archived, skipping message update.`);
            return;
        }
        const message = await thread.messages.fetch(voteData.statusMessageId);

        const newEmbed = new EmbedBuilder(message.embeds[0].toJSON())
            .setFields(
                { name: '当前票数', value: `${currentVotes}`, inline: true },
                { name: '目标票数', value: `${threshold}`, inline: true }
            );

        if (status === 'completed') {
            newEmbed.setColor(0x2ecc71).setDescription(reason);
        } else if (status === 'closed') {
            newEmbed.setColor(0x95a5a6).setDescription(reason);
        } else {
            newEmbed.setDescription('该帖子的投票正在进行中...');
        }

        await message.edit({ embeds: [newEmbed] });
    } catch (error) {
        console.error(`[updateVoteStatusMessage] Error updating status message for thread ${threadId}:`, error);
    }
}

async function closeVoteForThread(client, thread, configData, reason = '投票已结束') {
    console.log(`[closeVoteForThread] Closing vote for thread ${thread.id} with reason: ${reason}`);
    const actionConfig = configData.data.action_config || { locking: true, archive: false };
    const actionDescription = [];

    if (actionConfig.locking) {
        try {
            if (!thread.locked) {
                await thread.setLocked(true, reason);
                actionDescription.push('锁定');
                await sendLog(client, 'info', {
                    module: '帖子反应投票系统',
                    operation: '帖子自动锁定',
                    message: `帖子 ${thread.name} (${thread.id}) 因 ${reason} 已被锁定。`
                });
            }
        } catch (error) {
            console.error(`[closeVoteForThread] Failed to lock thread ${thread.id}:`, error);
        }
    }

    if (actionConfig.archive) {
        try {
            if (!thread.archived) {
                await thread.setArchived(true, reason);
                actionDescription.push('归档');
                await sendLog(client, 'info', {
                    module: '帖子反应投票系统',
                    operation: '帖子自动归档',
                    message: `帖子 ${thread.name} (${thread.id}) 因 ${reason} 已被归档。`
                });
            }
        } catch (error) {
            console.error(`[closeVoteForThread] Failed to archive thread ${thread.id}:`, error);
        }
    }

    const voteData = await getVoteData(thread.id);
    if (voteData) {
        let finalReason = reason;
        if (actionDescription.length > 0) {
            finalReason += `，帖子已${actionDescription.join('和')}。`;
        }
        await updateVoteStatusMessage(client, thread.id, voteData.voteCount, configData.data.threshold, 'closed', finalReason);
    }

    try {
        const filePath = getVoteFilePath(thread.id);
        await fs.unlink(filePath);
        console.log(`[closeVoteForThread] Deleted vote file for thread ${thread.id}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`[closeVoteForThread] Failed to delete vote file for thread ${thread.id}:`, error);
        }
    }
}

async function refreshAllVoteStatusMessages(client) {
    await ensureVoteDataDir();
    const files = await fs.readdir(voteDataDir);
    console.log(`[refreshAll] Found ${files.length} vote data files to process.`);

    for (const file of files) {
        if (path.extname(file) !== '.json') continue;

        const threadId = path.basename(file, '.json');
        try {
            const voteData = await getVoteData(threadId);
            if (!voteData || !voteData.statusMessageId) continue;

            const thread = await client.channels.fetch(threadId);
            if (!thread || !thread.isThread()) {
                console.log(`[refreshAll] Channel ${threadId} is not a valid thread, skipping.`);
                continue;
            }

            const configData = getReactionVoteConfig(thread.parentId);
            if (!configData) {
                console.log(`[refreshAll] No config found for parent channel ${thread.parentId}, skipping thread ${threadId}.`);
                continue;
            }

            const status = voteData.voteCount >= configData.data.threshold ? 'completed' : 'in_progress';
            let reason = '';
            if (status === 'completed') {
                reason = '投票已达到目标！';
            }
            await updateVoteStatusMessage(client, threadId, voteData.voteCount, configData.data.threshold, status, reason);
            console.log(`[refreshAll] Successfully refreshed vote status for thread ${threadId}.`);
        } catch (error) {
            console.error(`[refreshAll] Failed to refresh vote status for thread ${threadId}:`, error);
            if (error.code === 10003 || error.code === 10008) { // Unknown Channel or Unknown Message
                try {
                    await fs.unlink(getVoteFilePath(threadId));
                    console.log(`[refreshAll] Deleted stale vote data for thread ${threadId} due to error: ${error.message}`);
                } catch (unlinkError) {
                    console.error(`[refreshAll] Failed to delete stale vote data for ${threadId}:`, unlinkError);
                }
            }
        }
    }
}

module.exports = {
    handleReaction,
    initializeVoteFile,
    refreshAllVoteStatusMessages,
    closeVoteForThread,
    getVoteData
};