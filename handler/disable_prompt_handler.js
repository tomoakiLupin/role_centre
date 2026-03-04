const forumCommandsHandler = require('./forum_commands_handler');

class DisablePromptHandler {
    constructor() {
        this.commandName = '关闭自动提示';
        this.requiredPermission = 0;
    }

    async execute(interaction) {
        await forumCommandsHandler.executeDisablePrompt(interaction);
    }
}

module.exports = new DisablePromptHandler();
