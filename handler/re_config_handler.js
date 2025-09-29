const { config } = require('../config/config');
const { PERMISSION_LEVELS } = require('../utils/auth');

module.exports = {
    commandName: 're_config',
    requiredPermission: PERMISSION_LEVELS.DEVELOPER,

    async execute(interaction) {
        try {
            config.reload();
            console.log('Configuration reloaded successfully.');
            await interaction.reply({ content: '✅ 配置文件已成功重新加载。', ephemeral: true });
        } catch (error) {
            console.error('Error reloading configuration:', error);
            await interaction.reply({ content: '❌ 重新加载配置文件时出错。', ephemeral: true });
        }
    },
};