const { EmbedBuilder } = require('discord.js');
const { config } = require('../config/config');

/**
 * 发送日志消息到指定的频道
 * @param {import('discord.js').Client} client Discord 客户端实例
 * @param {string} level 日志等级 (e.g., 'info', 'warning', 'error', 'success')
 * @param {object} details 日志详情
 * @param {string} details.module 模块名称
 * @param {string} details.operation 操作名称
 * @param {string} details.message 附加信息
 */
async function sendLog(client, level, details) {
  const { module, operation, message } = details;
  const logChannelId = config.get('log.logger_config.log_channel_id');
  const levelInfo = config.get(`log.logger_config.log_levels.${level}`);

  if (!logChannelId || !levelInfo) {
    console.error('日志配置不完整，无法发送日志。');
    return;
  }

  try {
    const channel = await client.channels.fetch(logChannelId);
    if (!channel) {
      console.error(`找不到日志频道，ID: ${logChannelId}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(levelInfo.name || '日志')
      .setColor(levelInfo.color || '#ffffff')
      .addFields(
        { name: '模块', value: module, inline: true },
        { name: '操作', value: operation, inline: true },
        { name: '信息', value: message, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('发送日志时出错:', error);
  }
}

module.exports = {
  sendLog,
};