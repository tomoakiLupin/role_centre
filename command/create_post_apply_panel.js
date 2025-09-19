const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create_post_apply_panel')
    .setDescription('创建一个基于帖子反应的身份组申请面板')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('role_id')
        .setDescription('需要申请的身份组ID')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('reactions')
        .setDescription('帖子需要达到的最高反应数')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('帖子所在的论坛频道 (可选, 默认为所有频道)')
        .addChannelTypes(ChannelType.GuildForum)
        .setRequired(false))
    .addStringOption(option =>
      option.setName('grpc_config_id')
        .setDescription('gRPC 配置 ID (可选, 启用远程数据库查询)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('grpc_button_name')
        .setDescription('gRPC 查询按钮名称 (可选, 默认为"查询远程数据库（自动）")')
        .setRequired(false)),
};