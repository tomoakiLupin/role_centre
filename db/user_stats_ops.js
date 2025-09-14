/**
 * 批量更新用户统计数据
 * @param {import('sqlite3').Database} db 数据库实例
 * @param {Map<string, object>} userStats 用户统计数据
 * @returns {Promise<void>}
 */
function updateUserStats(db, userStats) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO user_stats (user_id, message_count, mention_count, mentioned_count, last_message_time, invalid_message_count)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        message_count = message_count + excluded.message_count,
        mention_count = mention_count + excluded.mention_count,
        mentioned_count = mentioned_count + excluded.mentioned_count,
        last_message_time = excluded.last_message_time,
        invalid_message_count = invalid_message_count + excluded.invalid_message_count;
    `);

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      userStats.forEach((stats, userId) => {
        stmt.run(
          userId,
          stats.message_count,
          stats.mention_count,
          stats.mentioned_count,
          stats.last_message_time,
          stats.invalid_message_count
        );
      });
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });

    stmt.finalize();
  });
}

module.exports = {
  updateUserStats,
};