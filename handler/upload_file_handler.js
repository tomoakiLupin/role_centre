const { EmbedBuilder } = require('discord.js');
const { getDbInstance } = require('../db/shared_files_db');
const { sendLog } = require('../utils/logger');
const crypto = require('crypto');

class UploadFileHandler {
    constructor() {
        this.commandName = 'upload_file';
        this.db = getDbInstance();
        this.requiredPermission = 0; // PERMISSION_LEVELS.NONE
    }

    async execute(interaction) {
        // 延迟回复，以便有时间处理
        await interaction.deferReply({ flags: [64] }); // ephemeral: true

        try {
            const attachment = interaction.options.getAttachment('file');
            const reqReaction = interaction.options.getBoolean('req_reaction') || false;
            const reqCaptcha = interaction.options.getBoolean('req_captcha') || false;
            const reqTerms = interaction.options.getBoolean('req_terms') || false;

            if (!attachment) {
                return await interaction.editReply({ content: '❌ 未能获取到文件附件。' });
            }

            // 获取原帖/原频道的 ID
            // 对于论坛中，thread 的 ID 就是开启这个 thread 的首条消息 ID
            const sourceMessageId = interaction.channelId;
            const uploaderId = interaction.user.id;

            // 生成随机的唯一提取码 (8位字符)
            const fileId = crypto.randomBytes(4).toString('hex').toUpperCase();

            const fileData = {
                id: fileId,
                uploader_id: uploaderId,
                file_name: attachment.name || `file_${fileId}`,
                file_url: attachment.url,
                upload_time: new Date().toISOString(),
                source_message_id: sourceMessageId,
                req_reaction: reqReaction,
                req_captcha: reqCaptcha,
                req_terms: reqTerms
            };

            await this.db.saveFileRecord(fileData);

            const embed = new EmbedBuilder()
                .setTitle('✅ 文件上传成功')
                .setDescription('您的文件已经成功记录，其他用户可以通过以下提取码获取。')
                .setColor(0x00ff00)
                .addFields(
                    { name: '📄 文件名', value: attachment.name || '未知', inline: true },
                    { name: '🔑 提取码 (File ID)', value: `\`${fileId}\``, inline: true },
                    { name: '🔧 获取条件', value: this.getConditionsText(reqReaction, reqCaptcha, reqTerms), inline: false }
                )
                .setFooter({ text: '请妥善保管提取码' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // 记录日志
            sendLog(interaction.client, 'info', {
                module: '文件分享',
                operation: '上传文件',
                message: `用户 <@${uploaderId}> 上传了文件: ${attachment.name}，提取码: ${fileId}`,
                details: fileData
            });

        } catch (error) {
            console.error('[UploadFileHandler] 上传文件出错:', error);
            await interaction.editReply({ content: '❌ 处理上传请求时发生内部错误。' }).catch(() => { });
        }
    }

    getConditionsText(reaction, captcha, terms) {
        const conditions = [];
        if (reaction) conditions.push('需要在当前帖子首楼点赞');
        if (captcha) conditions.push('需要输入验证码');
        if (terms) conditions.push('需要阅读注意事项并同意');

        return conditions.length > 0 ? conditions.join('，') : '无条件，直接下载';
    }
}

module.exports = new UploadFileHandler();
