const getFileHandler = require('./get_file_handler');

class GetSpecificWorkHandler {
    constructor() {
        this.commandName = '获取编号作品';
        this.requiredPermission = 0;
    }

    async execute(interaction) {
        await getFileHandler.execute(interaction);
    }
}

module.exports = new GetSpecificWorkHandler();
