const { getPermissionLevel, PERMISSION_LEVELS } = require('../../utils/auth');

class CommandHandler {
    constructor(commandRegistry) {
        this.commandRegistry = commandRegistry;
    }

    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
            return false;
        }

        // 处理自动补全
        if (interaction.isAutocomplete()) {
            return await this.handleAutocomplete(interaction);
        }

        const handler = this.commandRegistry.getHandler(interaction.commandName);

        if (!handler) {
            await interaction.reply({ content: '未知的命令。', ephemeral: true });
            return true;
        }

        // 权限验证
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        const userPermissionLevel = getPermissionLevel(interaction.user.id, userRoles);

        if (userPermissionLevel < (handler.requiredPermission || PERMISSION_LEVELS.USER)) {
            await interaction.reply({ content: '❌ 您没有足够的权限来执行此命令。', ephemeral: true });
            return true;
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

        return true;
    }

    async handleAutocomplete(interaction) {
        const command = this.commandRegistry.getCommand(interaction.commandName);

        if (command && typeof command.autocomplete === 'function') {
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`处理 ${interaction.commandName} 自动补全时出错:`, error);
            }
        }

        return true;
    }
}

module.exports = CommandHandler;