const forumCommandsHandler = require('./forum_commands_handler');

class PublishWorkHandler {
    constructor() {
        this.commandName = '发布作品';
        this.requiredPermission = 0;
    }

    async execute(interaction) {
        await forumCommandsHandler.executePublishWork(interaction);
    }
}

module.exports = new PublishWorkHandler();
