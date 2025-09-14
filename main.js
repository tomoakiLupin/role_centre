require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { sendLog } = require('./utils/logger');
const ScannerManager = require('./scanner/scanner_manager');
const fs = require('fs');
const path = require('path');
const CommandRegistry = require('./utils/command_registry');
const { getPermissionLevel, PERMISSION_LEVELS } = require('./utils/auth');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

const commandRegistry = new CommandRegistry();

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

    // 加载并注册命令
    commandRegistry.loadCommands(path.join(__dirname, 'command'));
    commandRegistry.loadHandlers(path.join(__dirname, 'handler'));

    const commands = commandRegistry.getAllCommands();
    if (commands.length > 0) {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        try {
            console.log('正在清除旧的全局斜杠命令...');
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            console.log('已清除全局斜杠命令。');

            for (const guildId of guildIds) {
                try {
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
                    console.log(`在服务器 ${guildId} 成功注册 ${commands.length} 个斜杠命令。`);
                } catch (error) {
                    console.error(`在服务器 ${guildId} 注册斜杠命令失败:`, error);
                }
            }
        } catch (error) {
            console.error('注册斜杠命令时出错:', error);
        }
    }

    const scannerManager = new ScannerManager(client);
    scannerManager.scheduleScans();
});

// 处理交互
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const handler = commandRegistry.getHandler(interaction.commandName);

        if (!handler) {
            return interaction.reply({ content: '未知的命令。', ephemeral: true });
        }

        // 权限验证
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        const userPermissionLevel = getPermissionLevel(interaction.user.id, userRoles);

        if (userPermissionLevel < (handler.requiredPermission || PERMISSION_LEVELS.USER)) {
            return interaction.reply({ content: '❌ 您没有足够的权限来执行此命令。', ephemeral: true });
        }

        try {
            await handler.execute(interaction);
        } catch (error) {
            console.error(`执行命令 ${interaction.commandName} 时出错:`, error);
            const reply = { content: '执行此命令时发生错误。', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    } else if (interaction.isButton()) {
        // 处理按钮交互
        try {
            const roleLeaveButtonHandler = require('./handler/button_handler/role_leave_button_handler');
            const roleButtonHandler = require('./handler/button_handler/role_button_handler');

            if (interaction.customId.startsWith('role_leave:')) {
                const cacheId = interaction.customId.split(':')[1];
                await roleLeaveButtonHandler.execute(interaction, cacheId);
            } else if (interaction.customId.startsWith('role_join:') || interaction.customId.startsWith('role_leave:')) {
                await roleButtonHandler.execute(interaction);
            }
            else {
                await interaction.reply({ content: '未知的按钮操作。', ephemeral: true });
            }
        } catch (error) {
            console.error('处理按钮交互时出错:', error);
            const reply = { content: '处理按钮交互时发生错误，请稍后重试。', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
