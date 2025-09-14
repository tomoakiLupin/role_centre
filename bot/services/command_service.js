const { REST, Routes } = require('discord.js');

class CommandService {
    constructor() {
        this.rest = null;
    }

    initialize(token) {
        this.rest = new REST().setToken(token);
    }

    async registerCommands(clientId, commands, guildIds) {
        if (!this.rest) {
            throw new Error('CommandService 未初始化，请先调用 initialize() 方法');
        }

        if (commands.length === 0) {
            console.log('没有命令需要注册。');
            return;
        }

        try {
            // 清除旧的全局斜杠命令
            console.log('正在清除旧的全局斜杠命令...');
            await this.rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log('已清除全局斜杠命令。');

            // 在指定的服务器中注册命令
            for (const guildId of guildIds) {
                try {
                    await this.rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
                    console.log(`在服务器 ${guildId} 成功注册 ${commands.length} 个斜杠命令。`);
                } catch (error) {
                    console.error(`在服务器 ${guildId} 注册斜杠命令失败:`, error);
                }
            }
        } catch (error) {
            console.error('注册斜杠命令时出错:', error);
            throw error;
        }
    }
}

module.exports = CommandService;