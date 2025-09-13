require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { sendLog } = require('./utils/logger');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Bot 已上线，登录为：${client.user.tag}`);
    sendLog(client, 'success', {
        module: '机器人',
        operation: '上线',
        message: `机器人 ${client.user.tag} 已成功启动并登录。`,
    });
});

client.login(process.env.DISCORD_TOKEN);
