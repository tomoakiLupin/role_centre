const path = require('path');
const BotClient = require('./client');
const CommandRegistry = require('../utils/command_registry');
const CommandService = require('./services/command_service');
const CommandHandler = require('./interactions/command_handler');
const ButtonHandler = require('./interactions/button_handler');
const ModalSubmitHandler = require('./interactions/modal_submit_handler');
const { startScheduledTasks } = require('./services/scheduler_service');
const MessageHandler = require('../handler/message_handler');
const { generateRoleMappingFile } = require('../handler/role_mapping_handler');
const { convertRoleAssignments } = require('../utils/role_assignment_converter');
const { setupReactionVoteHandlers } = require('../handler/reaction_vote_system/reaction_vote_handler');
const { scanActiveThreads } = require('../task/reaction_vote_scanner');
const { refreshAllVoteStatusMessages } = require('../handler/reaction_vote_system/reaction_vote_manager');

class Bot {
    constructor() {
        this.botClient = new BotClient();
        this.client = this.botClient.getClient();
        this.commandRegistry = new CommandRegistry();
        this.commandService = new CommandService();
        this.commandHandler = new CommandHandler(this.commandRegistry);
        this.buttonHandler = new ButtonHandler();
        this.modalSubmitHandler = new ModalSubmitHandler();
        this.scannerManager = null;
        this.messageHandler = null;

        this.setupInteractionHandlers();
        setupReactionVoteHandlers(this.client);
    }

    setupInteractionHandlers() {
        this.client.on('interactionCreate', async (interaction) => {
            // 尝试处理斜杠命令
            if (await this.commandHandler.handleInteraction(interaction)) {
                return;
            }

            // 尝试处理按钮交互
            if (await this.buttonHandler.handleInteraction(interaction)) {
                return;
            }

            // 尝试处理模态框提交
            if (await this.modalSubmitHandler.handleInteraction(interaction)) {
                return;
            }
        });
    }

    setupMessageHandler() {
        this.messageHandler = new MessageHandler(this.client);
        this.client.on('messageCreate', async (message) => {
            await this.messageHandler.handleMessage(message);
        });
    }

    async setupCommands() {
        // 加载机器人配置
        const botConfig = require('../config/bot_config.json');
        const guildIds = botConfig.main_config.safety_setting.command_push_guildids;

        // 加载并注册命令
        this.commandRegistry.loadCommands(path.join(__dirname, '../command'));
        this.commandRegistry.loadHandlers(path.join(__dirname, '../handler'));

        const commands = this.commandRegistry.getAllCommands();
        if (commands.length > 0) {
            this.commandService.initialize(process.env.DISCORD_TOKEN);
            await this.commandService.registerCommands(this.client.user.id, commands, guildIds);
        }
    }

    setupScanner() {
        const scannerManager = require('../task/scanner_manager');
        // 设置全局客户端引用
        global.client = this.client;
        // 直接调用 cron.schedule，它已经在 scanner_manager.js 中设置
        if (process.env.RUN_SCAN_ON_STARTUP === 'true') {
            console.log('[main_setup]立即启动所有扫描任务...');
            scannerManager.scanTask();
        }
    }

    setupScheduler() {
        startScheduledTasks(this.client);
    }

    async start() {
        // 设置ready事件处理
        this.client.once('clientReady', async () => {
            await convertRoleAssignments();
            await generateRoleMappingFile(this.client);
            await this.setupCommands();
            this.setupScanner();
            this.setupScheduler();
            this.setupMessageHandler();
            await scanActiveThreads(this.client);
            await refreshAllVoteStatusMessages(this.client);
        });

        // 登录机器人
        await this.botClient.login();
    }
}

module.exports = Bot;