const { initDatabase } = require('./db_init');
const { updateUserStats } = require('./user_stats_ops');

module.exports = {
  initDatabase,
  updateUserStats,
};