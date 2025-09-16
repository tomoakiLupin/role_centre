const { Client, GatewayIntentBits } = require('discord.js');
const { sendLog } = require('../utils/logger');

class BotClient {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.setupEvents();
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log(`Bot 已上线，登录为：${this.client.user.tag}`);
            sendLog(this.client, 'success', {
                module: '机器人',
                operation: '上线',
                message: `机器人 ${this.client.user.tag} 已成功启动并登录`,
            });
        });
    }

    getClient() {
        return this.client;
    }

    async login() {
        return await this.client.login(process.env.DISCORD_TOKEN);
    }
}

module.exports = BotClient;