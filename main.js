require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { sendLog } = require('./utils/logger');
const ScannerManager = require('./scanner/scanner_manager');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// 加载命令
async function loadCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'command');

    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            commands.push(command);
        }
    }

    return commands;
}

// 加载处理器
async function loadHandlers() {
    const handlers = new Map();
    const handlersPath = path.join(__dirname, 'handler');

    if (fs.existsSync(handlersPath)) {
        const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));

        for (const file of handlerFiles) {
            const handlerName = path.basename(file, '.js');
            const handler = require(path.join(handlersPath, file));
            handlers.set(handlerName, handler);
        }
    }

    return handlers;
}

client.once('ready', async () => {
    console.log(`Bot 已上线，登录为：${client.user.tag}`);
    sendLog(client, 'success', {
        module: '机器人',
        operation: '上线',
        message: `机器人 ${client.user.tag} 已成功启动并登录。`,
    });

    // 加载机器人配置
    const botConfig = require('./config/bot_config.json');
    const guildIds = botConfig.main_config.safety_setting.command_push_guildids;

    // 注册斜杠命令
    const commands = await loadCommands();
    if (commands.length > 0) {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);

        try {
            // 清除全局命令
            console.log('正在清除全局斜杠命令...');
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            console.log('已清除全局斜杠命令');

            // 只在指定服务器注册命令
            for (const guildId of guildIds) {
                try {
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
                    console.log(`在服务器 ${guildId} 成功注册 ${commands.length} 个斜杠命令`);
                } catch (error) {
                    console.error(`在服务器 ${guildId} 注册斜杠命令失败:`, error);
                }
            }
        } catch (error) {
            console.error('斜杠命令操作失败:', error);
        }
    }

    const scannerManager = new ScannerManager(client);
    await scannerManager.startAllScans();
});

// 处理斜杠命令交互
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handlers = await loadHandlers();
    const handlerName = interaction.commandName.replace(/[^a-zA-Z0-9_]/g, '_') + '_handler';
    const handler = handlers.get(handlerName);

    if (handler) {
        try {
            await handler.execute(interaction);
        } catch (error) {
            console.error(`执行命令 ${interaction.commandName} 时出错:`, error);
            const reply = { content: '执行命令时发生错误，请稍后重试。', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    } else {
        await interaction.reply({ content: '未找到对应的命令处理器。', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
