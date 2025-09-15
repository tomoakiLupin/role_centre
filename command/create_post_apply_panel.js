const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create_post_apply_panel')
    .setDescription('创建一个基于帖子反应的身份组申请面板')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('需要申请的身份组')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('reactions')
        .setDescription('帖子需要达到的最高反应数')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('帖子所在的论坛频道 (可选, 默认为所有频道)')
        .addChannelTypes(ChannelType.GuildForum)
        .setRequired(false)),
};