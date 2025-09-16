const { config } = require('../config/config');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function getUserStats(userId) {
    const totalStats = {
        message_count: 0,
        mention_count: 0,
        mentioned_count: 0,
        last_message_time: 0,
        invalid_message_count: 0,
    };

    const scanConfigs = config.get('channle_san.channels_scan_config');
    if (!scanConfigs) {
        return totalStats;
    }

    for (const key in scanConfigs) {
        if (key === 'sacn_cache_filepath') continue;

        const task = scanConfigs[key];
        const channel_id = task.data.channel_id;
        const dbPath = path.join(__dirname, '..', 'data', 'message_sacn', `data_${channel_id}.db`);

        try {
            const db = await open({
                filename: dbPath,
                driver: sqlite3.Database,
                mode: sqlite3.OPEN_READONLY
            });

            const userStat = await db.get('SELECT * FROM user_stats WHERE user_id = ?', userId);
            await db.close();

            if (userStat) {
                totalStats.message_count += userStat.message_count || 0;
                totalStats.mention_count += userStat.mention_count || 0;
                totalStats.mentioned_count += userStat.mentioned_count || 0;
                totalStats.invalid_message_count += userStat.invalid_message_count || 0;
                if (userStat.last_message_time > totalStats.last_message_time) {
                    totalStats.last_message_time = userStat.last_message_time;
                }
            }
        } catch (error) {
            // 如果数据库文件不存在，则忽略错误
            if (error.code !== 'SQLITE_CANTOPEN') {
                console.error(`查询数据库 ${dbPath} 时出错:`, error);
            }
        }
    }

    return totalStats;
}

module.exports = {
    getUserStats,
};