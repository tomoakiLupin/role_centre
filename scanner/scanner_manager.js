const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
const { sendLog } = require('../utils/logger');

const configPath = path.join(__dirname, '..', 'config', 'channle_san_config.json');

async function initializeDatabase(channel_id) {
    const dbPath = path.join(__dirname, '..', 'data', 'message_sacn', `data_${channel_id}.db`);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            message_count INTEGER DEFAULT 0,
            mention_count INTEGER DEFAULT 0,
            mentioned_count INTEGER DEFAULT 0,
            last_message_time INTEGER DEFAULT 0,
            invalid_message_count INTEGER DEFAULT 0
        )
    `);

    return db;
}

async function loadConfig() {
    try {
        const configData = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('加载配置文件失败:', error);
        return null;
    }
}

async function updateConfig(taskId, lastMessageId) {
    try {
        const config = await loadConfig();
        if (config && config.channels_scan_config[taskId]) {
            config.channels_scan_config[taskId].data.frist_message_id = lastMessageId;
            console.log(`任务 ${taskId} 的 frist_message_id 已更新为: ${lastMessageId}`);
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        }
    } catch (error) {
        console.error('更新配置失败:', error);
    }
}

async function scanChannel(taskId, task) {
    const { guilds_id, channel_id, frist_message_id } = task.data;
    console.log(`正在扫描服务器: ${guilds_id}, 频道: ${channel_id}`);

    const db = await initializeDatabase(channel_id);
    let totalMessagesScanned = 0;
    let totalMembersAffected = 0;

    try {
        if (!global.client || !global.client.isReady()) {
            console.error('Discord 客户端未就绪');
            return;
        }
        const client = global.client;

        const guild = await client.guilds.fetch(String(guilds_id));
        const channel = await guild.channels.fetch(String(channel_id));
        if (!channel) {
            console.error(`未找到频道: ${channel_id}`);
            return;
        }

        console.log(`开始扫描频道: ${channel.name} (${channel_id})`);

        let lastMessageId = String(frist_message_id);
        let hasMoreMessages = true;
        let cumulativeStats = {};
        let messagesSinceLastWrite = 0;

        while (hasMoreMessages) {
            const options = { limit: 100 };
            if (lastMessageId) {
                options.after = lastMessageId;
            }

            const messages = await channel.messages.fetch(options);
            totalMessagesScanned += messages.size;
            console.log(`在频道 ${channel_id} 获取了 ${messages.size} 条消息`);

            if (messages.size > 0) {
                lastMessageId = messages.first().id;
                messagesSinceLastWrite += messages.size;
            } else {
                hasMoreMessages = false;
            }

            for (const [, message] of messages) {
                if (message.author.bot) continue;

                const userId = message.author.id;
                const username = message.author.username;
                const messageTimestamp = message.createdTimestamp;

                if (!cumulativeStats[userId]) {
                    cumulativeStats[userId] = {
                        username,
                        message_count: 0,
                        mention_count: 0,
                        mentioned_count: 0,
                        last_message_time: 0,
                        invalid_message_count: 0
                    };
                }

                const content = message.content.trim();
                const hasAttachments = message.attachments.size > 0;
                const hasStickers = message.stickers.size > 0;
                const isStickerOnly = hasStickers && content === '' && !hasAttachments;
                const emojiRegex = /^(?:<a?:\w+:\d{18}>|\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u;
                const isEmojiOnly = content.length > 0 && emojiRegex.test(content) && !hasAttachments && !hasStickers;
                const isTooShort = content.length > 0 && content.length < 3 && !hasAttachments && !hasStickers;

                if (isStickerOnly || isEmojiOnly || isTooShort) {
                    cumulativeStats[userId].invalid_message_count++;
                } else {
                    cumulativeStats[userId].message_count++;
                    if (messageTimestamp > cumulativeStats[userId].last_message_time) {
                        cumulativeStats[userId].last_message_time = messageTimestamp;
                    }

                    const mentionedUsers = message.mentions.users;
                    const nonBotMentionsCount = mentionedUsers.filter(u => !u.bot).size;
                    if (nonBotMentionsCount > 0) {
                        cumulativeStats[userId].mention_count += nonBotMentionsCount;
                    }

                    for (const [mentionedId, mentionedUser] of mentionedUsers) {
                        if (mentionedUser.bot) continue;

                        if (!cumulativeStats[mentionedId]) {
                            cumulativeStats[mentionedId] = {
                                username: mentionedUser.username,
                                message_count: 0,
                                mention_count: 0,
                                mentioned_count: 0,
                                last_message_time: 0,
                                invalid_message_count: 0
                            };
                        }
                        cumulativeStats[mentionedId].mentioned_count++;
                    }
                }
            }

            if (messagesSinceLastWrite >= 1000 || (!hasMoreMessages && Object.keys(cumulativeStats).length > 0)) {
                if (Object.keys(cumulativeStats).length > 0) {
                    const membersAffectedInBatch = Object.keys(cumulativeStats).length;
                    totalMembersAffected += membersAffectedInBatch;
                    for (const userId in cumulativeStats) {
                        const { username, message_count, mention_count, mentioned_count, last_message_time, invalid_message_count } = cumulativeStats[userId];
                        await db.run(`
                            INSERT INTO user_stats (user_id, username, message_count, mention_count, mentioned_count, last_message_time, invalid_message_count)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(user_id)
                            DO UPDATE SET
                                username = excluded.username,
                                message_count = message_count + excluded.message_count,
                                mention_count = mention_count + excluded.mention_count,
                                mentioned_count = mentioned_count + excluded.mentioned_count,
                                last_message_time = IIF(excluded.last_message_time > last_message_time, excluded.last_message_time, last_message_time),
                                invalid_message_count = invalid_message_count + excluded.invalid_message_count
                        `, [userId, username, message_count, mention_count, mentioned_count, last_message_time, invalid_message_count]);
                    }
                    await updateConfig(taskId, lastMessageId);
                }

                cumulativeStats = {};
                messagesSinceLastWrite = 0;
            }
        }
        await sendLog(global.client, 'info', { module: 'Scanner', operation: 'Scan Complete', message: `频道 <#${channel_id}> 扫描完成 \\n共扫描 ${totalMessagesScanned} 条消息 \\n操作了 ${totalMembersAffected} 名成员 ` });
    } catch (error) {
        console.error(`扫描频道 ${channel_id} 时出错:`, error);
    } finally {
        await db.close();
        console.log(`频道 ${channel_id} 的数据库连接已关闭`);
    }
}

async function scanTask() {
    const config = await loadConfig();
    if (!config) {
        return;
    }
    const scanPromises = Object.entries(config.channels_scan_config)
        .filter(([key]) => key !== 'sacn_cache_filepath')
        .map(([taskId, task]) => scanChannel(taskId, task));

    await Promise.all(scanPromises);
}

cron.schedule('0 3 * * *', async () => {
    await sendLog(global.client, 'warn', { module: 'Scanner', operation: 'Start Cron Job', message: '开始执行定时扫描任务...' });
    await scanTask();
});

module.exports = {
    scanChannel,
    scanTask,
    loadConfig,
    updateConfig
};