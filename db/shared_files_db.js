const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SharedFilesDB {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/shared_files.sqlite');
        this.db = null;
    }

    async initDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('[SharedFilesDB] 无法连接到数据库:', err.message);
                    reject(err);
                } else {
                    this.db.serialize(() => {
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS shared_files (
                                id TEXT PRIMARY KEY,
                                uploader_id TEXT,
                                file_name TEXT,
                                file_url TEXT,
                                upload_time TEXT,
                                source_message_id TEXT,
                                req_reaction INTEGER DEFAULT 0,
                                req_captcha INTEGER DEFAULT 0,
                                req_terms INTEGER DEFAULT 0
                            )
                        `);

                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS user_downloads (
                                user_id TEXT,
                                download_date TEXT,
                                download_count INTEGER DEFAULT 0,
                                last_download_time TEXT,
                                PRIMARY KEY (user_id, download_date)
                            )
                        `);

                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS user_preferences (
                                user_id TEXT PRIMARY KEY,
                                disable_auto_prompt INTEGER DEFAULT 0
                            )
                        `, (err) => {
                            if (err) reject(err);
                            else resolve(this.db);
                        });
                    });
                }
            });
        });
    }

    async saveFileRecord(data) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO shared_files 
                (id, uploader_id, file_name, file_url, upload_time, source_message_id, req_reaction, req_captcha, req_terms) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                data.id,
                data.uploader_id,
                data.file_name,
                data.file_url,
                data.upload_time,
                data.source_message_id,
                data.req_reaction ? 1 : 0,
                data.req_captcha ? 1 : 0,
                data.req_terms ? 1 : 0,
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
            stmt.finalize();
        });
    }

    async getFileRecord(id) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM shared_files WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async checkAndUpdateDownloadLimit(userId, limit = 75) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            // Get today's date in YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0];

            this.db.get(
                `SELECT download_count FROM user_downloads WHERE user_id = ? AND download_date = ?`,
                [userId, today],
                (err, row) => {
                    if (err) return reject(err);

                    if (row) {
                        if (row.download_count >= limit) {
                            resolve(false); // 超过限制
                        } else {
                            // 更新次数
                            this.db.run(
                                `UPDATE user_downloads SET download_count = download_count + 1, last_download_time = ? WHERE user_id = ? AND download_date = ?`,
                                [new Date().toISOString(), userId, today],
                                (updateErr) => {
                                    if (updateErr) reject(updateErr);
                                    else resolve(true);
                                }
                            );
                        }
                    } else {
                        // 插入新记录
                        this.db.run(
                            `INSERT INTO user_downloads (user_id, download_date, download_count, last_download_time) VALUES (?, ?, 1, ?)`,
                            [userId, today, new Date().toISOString()],
                            (insertErr) => {
                                if (insertErr) reject(insertErr);
                                else resolve(true);
                            }
                        );
                    }
                }
            );
        });
    }

    async getUserPreference(userId) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT disable_auto_prompt FROM user_preferences WHERE user_id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.disable_auto_prompt === 1 : false);
            });
        });
    }

    async setUserPreference(userId, disablePrompt) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO user_preferences (user_id, disable_auto_prompt) 
                VALUES (?, ?) 
                ON CONFLICT(user_id) DO UPDATE SET disable_auto_prompt = ?
            `, [userId, disablePrompt ? 1 : 0, disablePrompt ? 1 : 0], (err) => {
                if (err) reject(err);
                else resolve(true);
            });
        });
    }

    async getLatestFileBySourceMessage(sourceMessageId) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM shared_files WHERE source_message_id = ? ORDER BY upload_time DESC LIMIT 1`, [sourceMessageId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

// Singleton
let instance = null;

module.exports = {
    getDbInstance: () => {
        if (!instance) {
            instance = new SharedFilesDB();
        }
        return instance;
    }
};
