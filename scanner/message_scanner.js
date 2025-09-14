const { Collection } = require('discord.js');

/**
 * 扫描频道消息并提取用户信息
 * @param {import('discord.js').TextChannel} channel 要扫描的频道
 * @param {object} options 扫描选项
 * @param {string} options.after 从此消息 ID 之后开始扫描
 * @param {number} [options.limit=100] 每次获取的消息数量
 * @returns {Promise<Map<string, object>>}
 */
async function scanChannelMessages(channel, options) {
  const { after, limit = 100 } = options;
  const userStats = new Map();

  let lastMessageId = after;
  let messages;

  do {
    messages = await channel.messages.fetch({ limit, after: lastMessageId });

    if (messages.size === 0) {
      break;
    }

    for (const message of messages.values()) {
      const userId = message.author.id;
      const stats = userStats.get(userId) || {
        message_count: 0,
        mention_count: 0,
        mentioned_count: 0,
        last_message_time: null,
        invalid_message_count: 0,
      };

      stats.message_count++;
      stats.last_message_time = message.createdAt.toISOString();

      // 统计主动提及
      if (message.mentions.users.size > 0 || message.mentions.roles.size > 0) {
        stats.mention_count++;
      }

      // 统计被动提及
      message.mentions.users.forEach(mentionedUser => {
        const mentionedUserId = mentionedUser.id;
        if (mentionedUserId !== userId) {
          const mentionedStats = userStats.get(mentionedUserId) || {
            message_count: 0,
            mention_count: 0,
            mentioned_count: 0,
            last_message_time: null,
            invalid_message_count: 0,
          };
          mentionedStats.mentioned_count++;
          userStats.set(mentionedUserId, mentionedStats);
        }
      });

      userStats.set(userId, stats);
    }

    lastMessageId = messages.last().id;
  } while (messages.size === limit);

  return userStats;
}

module.exports = {
  scanChannelMessages,
};