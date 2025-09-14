const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * 初始化数据库并创建 user_stats 表
 * @param {string} dbPath 数据库文件的路径
 * @returns {Promise<sqlite3.Database>}
 */
function initDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('无法连接到数据库:', err.message);
        reject(err);
      } else {
        console.log('成功连接到数据库:', dbPath);
        db.run(`
          CREATE TABLE IF NOT EXISTS user_stats (
            user_id TEXT PRIMARY KEY,
            message_count INTEGER DEFAULT 0,
            mention_count INTEGER DEFAULT 0,
            mentioned_count INTEGER DEFAULT 0,
            last_message_time TEXT,
            invalid_message_count INTEGER DEFAULT 0
          )
        `, (err) => {
          if (err) {
            console.error('创建 user_stats 表失败:', err.message);
            reject(err);
          } else {
            console.log('user_stats 表已成功创建或已存在。');
            resolve(db);
          }
        });
      }
    });
  });
}

module.exports = {
  initDatabase,
};