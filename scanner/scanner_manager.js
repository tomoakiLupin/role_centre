const { getConfig } = require('../config/config');
const FileEditor = require('../utils/file_editor');
const { initDatabase, updateUserStats } = require('../db/message_scanner_db');
const { scanChannelMessages } = require('./message_scanner');

class ScannerManager {
  constructor(client) {
    this.client = client;
    this.config = getConfig().get('channle_san');
    this.cacheEditor = new FileEditor(this.config.channels_scan_config.sacn_cache_filepath);
  }

  async startAllScans() {
    const scanConfigs = this.config.channels_scan_config;
    const channelKeys = Object.keys(scanConfigs)
      .filter(key => key !== 'sacn_cache_filepath')
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    for (const key of channelKeys) {
      const channelConfig = scanConfigs[key].data;
      await this.runScan(channelConfig);
    }
  }

  async runScan(channelConfig) {
    const { guilds_id, channel_id, frist_message_id } = channelConfig;
    const dbPath = this.config.channels_scan_config[channel_id].db_path;

    const cache = await this.cacheEditor.read() || {};
    const lastMessageId = cache[channel_id] || frist_message_id;

    const channel = await this.client.channels.fetch(channel_id);
    if (!channel) {
      console.error(`找不到频道: ${channel_id}`);
      return;
    }

    console.log(`开始扫描频道: ${channel.name} (ID: ${channel_id})`);

    const userStats = await scanChannelMessages(channel, { after: lastMessageId });

    if (userStats.size > 0) {
      const db = await initDatabase(dbPath);
      await updateUserStats(db, userStats);
      db.close();

      const newLastMessageId = userStats.values().next().value.last_message_time;
      await this.cacheEditor.atomic_write(currentCache => {
        const newCache = currentCache || {};
        newCache[channel_id] = newLastMessageId;
        return newCache;
      });

      console.log(`频道 ${channel.name} 扫描完成，更新了 ${userStats.size} 个用户的数据。`);
    } else {
      console.log(`频道 ${channel.name} 没有新消息。`);
    }
  }
}

module.exports = ScannerManager;