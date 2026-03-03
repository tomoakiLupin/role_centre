const forumCommandsHandler = require('./forum_commands_handler');

class EnablePromptHandler {
    constructor() {
        this.commandName = '启用自动提示';
        this.requiredPermission = 0;
    }

    async execute(interaction) {
        await forumCommandsHandler.executeEnablePrompt(interaction);
    }
}

module.exports = new EnablePromptHandler();
