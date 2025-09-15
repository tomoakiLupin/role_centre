const { getConfig } = require('../config/config');
const FileEditor = require('../utils/file_editor');
const { initDatabase } = require('../db/message_scanner_db');
const cron = require('node-cron');

class ScannerManager {
  constructor(client) {
    this.client = client;
    this.config = getConfig().get('channle_san');

    if (!this.config || !this.config.channels_scan_config) {
      throw new Error('扫描器配置 (channle_san_config.json) 加载失败或格式不正确。');
    }

    const cachePath = this.config.channels_scan_config.sacn_cache_filepath;
    if (!cachePath) {
      throw new Error('在 channle_san_config.json 中未找到 sacn_cache_filepath 配置。');
    }

    this.cacheEditor = new FileEditor(cachePath);
  }

  async startAllScans() {
    const scanConfigs = this.config.channels_scan_config;
    const channelKeys = Object.keys(scanConfigs)
      .filter(key => key !== 'sacn_cache_filepath')
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    const tasks = channelKeys.map(key => {
      const channelConfig = scanConfigs[key].data;
      const dbPath = scanConfigs[key].db_path;
      return () => this.runScan(channelConfig, dbPath);
    });

    await this.runTasksWithConcurrency(tasks, 3);
  }

  async runTasksWithConcurrency(tasks, concurrency) {
    const results = [];
    let currentIndex = 0;

    const runNext = async () => {
      if (currentIndex >= tasks.length) {
        return;
      }

      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];

      try {
        results[taskIndex] = await task();
      } catch (error) {
        results[taskIndex] = error;
      }

      await runNext();
    };

    const workers = Array(concurrency).fill(null).map(() => runNext());
    await Promise.all(workers);

    return results;
  }

 scheduleScans() {
   // 每天凌晨4点执行
   cron.schedule('0 4 * * *', () => {
     console.log('开始执行每日消息扫描任务...');
     this.startAllScans();
   }, {
     scheduled: true,
     timezone: "Asia/Shanghai"
   });
 }

  async runScan(channelConfig, dbPath) {
    const { channel_id, frist_message_id } = channelConfig;
    const limit = 100;
    const batchWriteThreshold = 1000; // 每1000条消息写一次库

    const cache = await this.cacheEditor.read() || {};
    let lastMessageId = cache[channel_id] || frist_message_id;

    const channel = await this.client.channels.fetch(channel_id);
    if (!channel) {
      console.error(`找不到频道: ${channel_id}`);
      return;
    }

    console.log(`开始扫描频道: ${channel.name} (ID: ${channel_id})`);
    const db = await initDatabase(dbPath);

    let cumulativeStats = new Map();
    let messagesSinceLastWrite = 0;
    let totalMessagesProcessed = 0;
    let hasMoreMessages = true;

    try {
      while (hasMoreMessages) {
        console.log(`[${channel.name}] 正在从消息 ID: ${lastMessageId} 后获取下一批消息...`);
        const messages = await channel.messages.fetch({ limit, after: lastMessageId });
        console.log(`[${channel.name}] 本批次获取到 ${messages.size} 条消息。`);

        if (messages.size > 0) {
          lastMessageId = messages.last().id; // 正确处理分页
          messagesSinceLastWrite += messages.size;
          totalMessagesProcessed += messages.size;

          //  开始处理消息 (移植的核心逻辑) 
          for (const message of messages.values()) {
            if (message.author.bot) continue;

            const userId = message.author.id;
            const username = message.author.username;
            const stats = cumulativeStats.get(userId) || {
              username: username,
              message_count: 0,
              mention_count: 0, // 主动提及他人
              mentioned_count: 0, // 被他人提及
              last_message_time: 0,
              invalid_message_count: 0,
            };

            //  开始整合无效发言逻辑
            const content = message.content.trim();
            const hasAttachments = message.attachments.size > 0;
            const hasStickers = message.stickers.size > 0;
            const isStickerOnly = hasStickers && content === '' && !hasAttachments;
            const emojiRegex = /^(?:<a?:\w+:\d{18}>|\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u;
            const isEmojiOnly = content.length > 0 && emojiRegex.test(content) && !hasAttachments && !hasStickers;
            const isTooShort = content.length > 0 && content.length < 3 && !hasAttachments && !hasStickers;

            if (isStickerOnly || isEmojiOnly || isTooShort) {
              stats.invalid_message_count++;
            } else {
              // 只有有效消息才计入总数和更新其他统计
              stats.message_count++;
              if (message.createdTimestamp > stats.last_message_time) {
                stats.last_message_time = message.createdTimestamp;
              }

              // 统计主动提及
              if (message.mentions.users.size > 0 || message.mentions.roles.size > 0) {
                stats.mention_count++;
              }

              // 统计被动提及
              message.mentions.users.forEach(mentionedUser => {
                if (mentionedUser.bot || mentionedUser.id === userId) return;
                const mentionedStats = cumulativeStats.get(mentionedUser.id) || {
                  username: mentionedUser.username, message_count: 0, mention_count: 0, mentioned_count: 0, last_message_time: 0, invalid_message_count: 0,
                };
                mentionedStats.mentioned_count++;
                cumulativeStats.set(mentionedUser.id, mentionedStats);
              });
            }
            //  无效发言逻辑结束

            cumulativeStats.set(userId, stats);
          }
          //  消息处理结束 

        } else {
          hasMoreMessages = false;
        }

        //开始批量写入数据库
        if (messagesSinceLastWrite >= batchWriteThreshold || (!hasMoreMessages && cumulativeStats.size > 0)) {
          console.log(`[${channel.name}] 达到写入阈值，准备写入 ${cumulativeStats.size} 个用户的统计数据。`);
          await db.run('BEGIN TRANSACTION');
          console.log(`[${channel.name}] 数据库事务已开始。`);
          const stmt = await db.prepare(`
            INSERT INTO user_stats (user_id, username, message_count, mention_count, mentioned_count, last_message_time, invalid_message_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              username = excluded.username,
              message_count = message_count + excluded.message_count,
              mention_count = mention_count + excluded.mention_count,
              mentioned_count = mentioned_count + excluded.mentioned_count,
              last_message_time = MAX(last_message_time, excluded.last_message_time),
              invalid_message_count = invalid_message_count + excluded.invalid_message_count;
          `);

          for (const [userId, stats] of cumulativeStats.entries()) {
            await stmt.run(userId, stats.username, stats.message_count, stats.mention_count, stats.mentioned_count, stats.last_message_time, stats.invalid_message_count);
          }
          await stmt.finalize();
          await db.run('COMMIT');
          console.log(`[${channel.name}] 数据库事务已提交。`);

          // 更新缓存并报告进度
          console.log(`[${channel.name}] 准备更新缓存文件...`);
          await this.cacheEditor.atomic_write(currentCache => {
            const newCache = currentCache || {};
            newCache[channel_id] = lastMessageId;
            return newCache;
          });
          console.log(`[${channel.name}] 缓存文件已更新。`);
          
          console.log(`[${channel.name}] [进度] 已处理并保存 ${messagesSinceLastWrite} 条消息。累计处理: ${totalMessagesProcessed}。`);

          // 重置计数器
          cumulativeStats.clear();
          messagesSinceLastWrite = 0;
        }
        //  批量写入结束 
      }
    } catch (error) {
      console.error(`扫描频道 ${channel.name} 时出错:`, error);
      if (db) await db.run('ROLLBACK').catch(e => console.error('回滚失败', e));
    } finally {
      if (db) db.close();
      if (totalMessagesProcessed > 0) {
        console.log(`频道 ${channel.name} 扫描完成，共处理 ${totalMessagesProcessed} 条消息。`);
      } else {
        console.log(`频道 ${channel.name} 没有新消息。`);
      }
    }
  }
}

module.exports = ScannerManager;