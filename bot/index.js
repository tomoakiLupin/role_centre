const path = require('path');
const BotClient = require('./client');
const CommandRegistry = require('../utils/command_registry');
const CommandService = require('./services/command_service');
const CommandHandler = require('./interactions/command_handler');
const ButtonHandler = require('./interactions/button_handler');
const ModalSubmitHandler = require('./interactions/modal_submit_handler');
const ScannerManager = require('../scanner/scanner_manager');

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

        this.setupInteractionHandlers();
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
        this.scannerManager = new ScannerManager(this.client);
        this.scannerManager.scheduleScans();
    }

    async start() {
        // 设置ready事件处理
        this.client.once('ready', async () => {
            await this.setupCommands();
            this.setupScanner();
        });

        // 登录机器人
        await this.botClient.login();
    }
}

module.exports = Bot;