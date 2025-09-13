require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Bot 已上线，登录为：${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
