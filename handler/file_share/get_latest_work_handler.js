const forumCommandsHandler = require('./forum_commands_handler');

class GetLatestWorkHandler {
    constructor() {
        this.commandName = '获取作品';
        this.requiredPermission = 0;
    }

    async execute(interaction) {
        await forumCommandsHandler.executeGetLatestWork(interaction);
    }
}

module.exports = new GetLatestWorkHandler();
