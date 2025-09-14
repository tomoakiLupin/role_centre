const { initDatabase } = require('./db_init');
const path = require('path');

class EligibilityChecker {
    constructor() {
        this.databases = new Map(); // 缓存数据库连接
    }

    async checkUserEligibility(userId, configData) {
        const { database_name, database_kv, threshold } = configData;

        try {
            // 检查配置完整性
            if (!database_name || !database_kv || !threshold) {
                console.warn('[EligibilityChecker] 配置缺少必要参数:', { database_name, database_kv, threshold });
                return { eligible: false, reason: '配置错误' };
            }

            let totalValue = 0;

            // 查询所有数据库
            for (const dbName of database_name) {
                const dbPath = path.join(__dirname, '..', 'data', 'message_sacn', dbName);
                const db = await this.getDatabase(dbPath);

                const userStats = await this.getUserStats(db, userId);

                // 累加指定字段的值
                for (const field of database_kv) {
                    if (userStats && userStats[field] !== undefined) {
                        totalValue += userStats[field];
                    }
                }
            }

            const eligible = totalValue >= threshold;

            return {
                eligible,
                totalValue,
                threshold,
                reason: eligible ? '符合条件' : `当前值: ${totalValue}, 需要: ${threshold}`
            };

        } catch (error) {
            console.error('[EligibilityChecker] 检查用户资格时出错:', error);
            return { eligible: false, reason: '系统错误', error: error.message };
        }
    }

    async getDatabase(dbPath) {
        if (this.databases.has(dbPath)) {
            return this.databases.get(dbPath);
        }

        const db = await initDatabase(dbPath);
        this.databases.set(dbPath, db);
        return db;
    }

    async getUserStats(db, userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM user_stats WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    // 清理数据库连接
    closeAllConnections() {
        this.databases.forEach(db => {
            try {
                db.close();
            } catch (error) {
                console.warn('关闭数据库连接时出错:', error);
            }
        });
        this.databases.clear();
    }
}

// 单例模式
let instance = null;

module.exports = {
    getEligibilityChecker() {
        if (!instance) {
            instance = new EligibilityChecker();
        }
        return instance;
    }
};