const { removeRolesFromUser } = require('../utils/role_remover');
const { EmbedBuilder } = require('discord.js');
const { PERMISSION_LEVELS } = require('../utils/auth');

class RemoveRoleHandler {
    constructor() {
        this.commandName = 'remove_role';
        this.requiredPermission = PERMISSION_LEVELS.ADMIN;
    }

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const roleIds = interaction.options.getString('roles');
        const reason = interaction.options.getString('reason');
        const operator = interaction.user;

        await interaction.deferReply({ ephemeral: true });

        const result = await removeRolesFromUser({
            userId: targetUser.id,
            guildId: interaction.guild.id,
            roleIds: roleIds,
            reason: reason,
            operatorId: operator.id,
        });

        if (result.removedRoles.length > 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('身份组移除')
                .setDescription(`**用户 ${targetUser.tag} (<@${targetUser.id}>) 的身份组已被移除**`)
                .addFields(
                    { name: '原因', value: reason, inline: false },
                    { name: '被移除的身份组', value: result.removedRoles.map(r => `${r.name} (<@&${r.id}>)`).join('\n'), inline: false }
                )
                .setTimestamp();
            
            if (result.failedRoles.length > 0) {
                embed.addFields({ name: '失败的身份组', value: result.failedRoles.map(r => `${r.id}: ${r.reason}`).join('\n'), inline: false });
            }

            await interaction.channel.send({ embeds: [embed] });
            await interaction.editReply({ content: '身份组移除成功，并已发送通知。' });
        } else {
            let errorMessage = '无法移除任何身份组。';
            if (result.failedRoles.length > 0) {
                errorMessage += '\n**失败详情:**\n' + result.failedRoles.map(r => `${r.id}: ${r.reason}`).join('\n');
            }
            await interaction.editReply({ content: errorMessage });
        }
    }
}

module.exports = new RemoveRoleHandler();