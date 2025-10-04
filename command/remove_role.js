const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove_role')
        .setDescription('Removes a specified role from a user with a reason.')
        .setNameLocalizations({
            'zh-CN': '移除身份组',
            'zh-TW': '移除身份組'
        })
        .setDescriptionLocalizations({
            'zh-CN': '移除某个用户的某个指定的身份组并给出原因',
            'zh-TW': '移除某個用戶的某個指定的身份組並給出原因'
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove the role from.')
                .setRequired(true)
                .setNameLocalizations({
                    'zh-CN': '用户',
                    'zh-TW': '用戶'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '要移除身份组的用户',
                    'zh-TW': '要移除身份組的用戶'
                })
        )
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('The role(s) to remove (comma-separated IDs).')
                .setRequired(true)
                .setNameLocalizations({
                    'zh-CN': '身份组',
                    'zh-TW': '身份組'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '要移除的身份组ID，多个请用逗号隔开',
                    'zh-TW': '要移除的身份組ID，多個請用逗號隔開'
                })
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for removing the role.')
                .setRequired(true)
                .setNameLocalizations({
                    'zh-CN': '原因',
                    'zh-TW': '原因'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '移除身份组的原因',
                    'zh-TW': '移除身份組的原因'
                })
        ),
    async execute(interaction) {
        // Command execution logic will be handled by a dedicated handler.
    },
};