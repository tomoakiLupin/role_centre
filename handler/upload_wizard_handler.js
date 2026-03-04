const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, FileUploadBuilder, LabelBuilder } = require('discord.js');
const https = require('https');
const forumPanelHandler = require('./forum_panel_handler');
const { getDbInstance } = require('../db/shared_files_db');

// State memory for active wizards
const wizardStates = new Map();

class UploadWizardHandler {
    constructor() {
        this.db = getDbInstance();
    }

    // Creates the initial state and sends the panel
    async startWizard(interaction) {
        const stateId = interaction.id;

        // 解析如果来自 /发布作品 斜杠命令的可选参数
        let initialFileUrl = null;
        let initialFileName = null;
        let initialMode = 0;
        let initialCaptcha = null;
        let initialTerms = false;

        if (interaction.isCommand && interaction.isCommand()) {
            const attachment = interaction.options.getAttachment('file');
            if (attachment) {
                initialFileUrl = attachment.url;
                initialFileName = attachment.name;
            }
            if (interaction.options.getString('req_reaction') === 'true') initialMode = 1;

            const captchaText = interaction.options.getString('captcha_text');
            if (captchaText && captchaText.trim().length > 0) initialCaptcha = captchaText.trim();
            else if (interaction.options.getString('req_captcha') === 'true') initialCaptcha = '默认验证码';

            if (interaction.options.getString('req_terms') === 'true') {
                initialTerms = true;
            }
        }

        wizardStates.set(stateId, {
            mode: initialMode, // 0: 无限制, 1: 点赞, 2: 点赞或回复
            captcha: initialCaptcha, // string
            daily_limit: false, // false: 开放分享, true: 每日限定
            terms_enabled: initialTerms,
            terms_content: initialTerms ? '（由斜杠命令启用，请修改）' : null, // string
            file_url: initialFileUrl, // string
            file_name: initialFileName // string
        });

        // 首次必须使用 reply 或 followUp。如果是按钮点击，用 reply (ephemeral) 即可。如果是 slash command, 用 editReply/followUp。
        // 但为了统一，这里接收 interaction，直接生成 component 并回复。
        const messagePayload = this.buildWizardPayload(stateId);

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ ...messagePayload, flags: [64] });
        } else {
            await interaction.reply({ ...messagePayload, flags: [64] });
        }
    }

    buildWizardPayload(stateId) {
        const state = wizardStates.get(stateId);
        if (!state) return { content: '❌ 会话已过期。', components: [] };

        // 构造 Embed
        const embed = new EmbedBuilder()
            .setTitle('作品发布面板')
            .setColor(0x2f3136)
            .setDescription('**获取作品需求**\n当前模式: **' +
                (state.mode === 0 ? '无限制' : (state.mode === 1 ? '点赞' : '点赞或回复')) + '**\n\n' +
                '**提取码**\n' +
                '点击按钮切换是否启用用来和上方的需求进行组合 (无限制 + 启用提取码为纯提取码模式)\n' +
                '🎈 记得将提取码置于贴内\n' +
                '⚠️ 开头或结尾的空格将被自动清理\n\n' +
                '**获取次数设置**\n' +
                '可以设置当用户的当日获取作品次数耗尽时，是否依然允许其获取本作品？\n' +
                '当前设置: ' + (state.daily_limit ? '**每日限定**: 耗尽后不可获取' : '**开放分享**: 耗尽后仍可获取') + '\n\n' +
                '**作者声明**\n' +
                '当前状态: **' + (state.terms_enabled ? '已启用' : '已关闭') + '**\n' +
                '> 在用户下载作品前将先使用本条内容提示一遍用户，要求用户二次确认声明内容\n\n' +
                '**当前声明内容:**\n' +
                (state.terms_content ? state.terms_content : '已禁用') + '\n\n' +
                '**当前附件:**\n' +
                (state.file_name ? `✅ 已添加: **${state.file_name}**` : '❌ 未添加')
            )
            .setFooter({ text: '如使用中有任何问题或建议请前往: 反馈频道' });

        // 如果上传了图片，显示缩略图
        if (state.file_url && state.file_content_type && state.file_content_type.startsWith('image/')) {
            embed.setImage(state.file_url);
        }

        // Row 1: 模式
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`wiz_mode_0:${stateId}`).setLabel('☀️ 无限制').setStyle(state.mode === 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wiz_mode_1:${stateId}`).setLabel('❤️ 点赞').setStyle(state.mode === 1 ? ButtonStyle.Danger : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wiz_mode_2:${stateId}`).setLabel('🎁 点赞或回复').setStyle(state.mode === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary) // Discord doesn't have an orange one so Primary (Blue) or Secondary
        );

        // Row 2: 提取码 & 次数设置
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wiz_captcha:${stateId}`)
                .setLabel(state.captcha !== null ? `# 提取码: ${state.captcha}` : '# 提取码: 已关闭')
                .setStyle(state.captcha !== null ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`wiz_limit_0:${stateId}`)
                .setLabel('🎀 开放分享')
                .setStyle(!state.daily_limit ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`wiz_limit_1:${stateId}`)
                .setLabel('🏷️ 每日限定')
                .setStyle(state.daily_limit ? ButtonStyle.Secondary : ButtonStyle.Secondary)
        );

        // Row 3: 作者声明
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wiz_terms_on:${stateId}`)
                .setLabel('🔔 启用')
                .setStyle(state.terms_enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`wiz_terms_off:${stateId}`)
                .setLabel('🔕 关闭')
                .setStyle(!state.terms_enabled ? ButtonStyle.Danger : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`wiz_terms_input:${stateId}`)
                .setLabel('📝 输入声明')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!state.terms_enabled)
        );

        // Row 4: 文件与发布
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wiz_file:${stateId}`)
                .setLabel(state.file_name ? '🔁 更改作品' : '➕ 添加作品')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`wiz_submit:${stateId}`)
                .setLabel('📩 发布')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!state.file_name), // 文件是必须的
            new ButtonBuilder()
                .setCustomId(`wiz_cancel:${stateId}`)
                .setLabel('⚠️ 取消')
                .setStyle(ButtonStyle.Danger)
        );

        return { content: '', embeds: [embed], components: [row1, row2, row3, row4] };
    }

    async handleButton(interaction) {
        const customId = interaction.customId;
        if (!customId.startsWith('wiz_')) return false;

        if (customId === 'wiz_start') {
            await this.startWizard(interaction);
            return true;
        }

        const parts = customId.split(':');
        const action = parts[0];
        const stateId = parts[1];

        const state = wizardStates.get(stateId);
        if (!state) {
            return await interaction.reply({ content: '❌ 该面板已失效，请重新生成。', flags: [64] });
        }

        // State modifications
        if (action === 'wiz_mode_0') state.mode = 0;
        else if (action === 'wiz_mode_1') state.mode = 1;
        else if (action === 'wiz_mode_2') state.mode = 2;
        else if (action === 'wiz_limit_0') state.daily_limit = false;
        else if (action === 'wiz_limit_1') state.daily_limit = true;
        else if (action === 'wiz_terms_on') state.terms_enabled = true;
        else if (action === 'wiz_terms_off') {
            state.terms_enabled = false;
            state.terms_content = null;
        }

        // Captcha Modal
        if (action === 'wiz_captcha') {
            const modal = new ModalBuilder()
                .setCustomId(`wiz_modal_captcha:${stateId}`)
                .setTitle('设置提取码 (留空为关闭)');

            const input = new TextInputBuilder()
                .setCustomId('captcha_input')
                .setLabel('提取码 / 密码')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(state.captcha || '');

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // Terms Modal
        if (action === 'wiz_terms_input') {
            const modal = new ModalBuilder()
                .setCustomId(`wiz_modal_terms:${stateId}`)
                .setTitle('作者声明内容');

            const input = new TextInputBuilder()
                .setCustomId('terms_input')
                .setLabel('请输入声明（同意后才可下载）')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setValue(state.terms_content || '');

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }

        // File Upload Modal (native file picker) - Component V2
        if (action === 'wiz_file') {
            const fileUpload = new FileUploadBuilder()
                .setCustomId('file_upload_input')
                .setRequired(true);

            const label = new LabelBuilder()
                .setLabel('请选择文件')
                .setDescription('支持最多 10 个文件，单个文件上限 100 MB')
                .setFileUploadComponent(fileUpload);

            const modalData = {
                title: '上传作品',
                custom_id: `wiz_modal_file:${stateId}`,
                // Label (type:18) 直接放在 components 里，无需 ActionRow 包裹
                components: [
                    {
                        type: 18, // ComponentType.LABEL
                        label: '请选择文件',
                        description: '支持最多 10 个文件，单个文件上限 100 MB',
                        component: {
                            type: 19, // ComponentType.FILE_UPLOAD
                            custom_id: 'file_upload_input',
                            required: true,
                            max_values: 10
                        }
                    }
                ]
            };

            // 绕过 discord.js, 直接用 Node.js https 请求 Discord API，附带 flags: 32768
            await new Promise((resolve, reject) => {
                const body = JSON.stringify({ type: 9, data: modalData });
                const req = https.request({
                    hostname: 'discord.com',
                    path: `/api/v10/interactions/${interaction.id}/${interaction.token}/callback`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                        'User-Agent': 'DiscordBot (custom, 1.0)'
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        console.log(`[WizardModal] Discord responded: ${res.statusCode}`);
                        if (data) console.log(`[WizardModal] Body: ${data}`);
                        resolve();
                    });
                });
                req.on('error', (e) => { console.error('[WizardModal] HTTPS error:', e); reject(e); });
                req.write(body);
                req.end();
            });
            interaction.replied = true;
            return;
        }

        // Submit & Cancel
        if (action === 'wiz_cancel') {
            wizardStates.delete(stateId);
            return await interaction.update({ content: '已取消发布。', embeds: [], components: [] });
        }

        if (action === 'wiz_submit') {
            if (!state.file_url) {
                return await interaction.reply({ content: '❌ 必须先添加作品链接！', flags: [64] });
            }

            await interaction.deferUpdate();

            const fileId = await this.db.getNextFileId();
            const sourceMessageId = interaction.channelId; // Thread ID

            const fileData = {
                id: fileId,
                uploader_id: interaction.user.id,
                file_name: state.file_name || `Published_File_${fileId}`,
                file_url: state.file_url,
                extra_files: (state.files && state.files.length > 1)
                    ? state.files.slice(1).map(f => ({ url: f.url, name: f.name }))
                    : null,
                upload_time: new Date().toISOString(),
                source_message_id: sourceMessageId,
                req_reaction: state.mode > 0,
                req_captcha: state.captcha !== null,
                req_terms: state.terms_enabled,
                captcha_text: state.captcha,
                terms_content: state.terms_content || null
            };

            try {
                await this.db.saveFileRecord(fileData);

                // 发送公开面板
                const channel = interaction.channel;
                const publicMessage = await channel.send('正在生成全新作品面板...');
                const fakeContext = { message: publicMessage };
                await forumPanelHandler.convertToPublicPanel(fakeContext, fileData);

                wizardStates.delete(stateId);
                await interaction.editReply({ content: `✅ 作品已成功发布！\n文件代码: \`${fileId}\``, embeds: [], components: [] });

            } catch (err) {
                console.error('[UploadWizard] 发布错误:', err);
                await interaction.followUp({ content: '❌ 保存时发生数据库错误。', flags: [64] });
            }
            return;
        }

        // Standard Button Update
        await interaction.update(this.buildWizardPayload(stateId));
        return true;
    }

    async handleModalSubmit(interaction) {
        const customId = interaction.customId;
        if (!customId.startsWith('wiz_modal_')) return false;

        const parts = customId.split(':');
        const action = parts[0];
        const stateId = parts[1];

        const state = wizardStates.get(stateId);
        if (!state) {
            return await interaction.reply({ content: '❌ 该面板已失效，请重新生成。', flags: [64] });
        }

        if (action === 'wiz_modal_captcha') {
            const input = interaction.fields.getTextInputValue('captcha_input').trim();
            state.captcha = input.length > 0 ? input : null;
        } else if (action === 'wiz_modal_terms') {
            const input = interaction.fields.getTextInputValue('terms_input').trim();
            state.terms_content = input.length > 0 ? input : null;
            if (state.terms_content) state.terms_enabled = true;
        } else if (action === 'wiz_modal_file') {
            // 调试：打印完整的 fields 数据结构
            console.log('[UploadWizard] 调试 fields.components:', JSON.stringify(interaction.fields?.components, null, 2));
            console.log('[UploadWizard] 调试 fields.fields keys:', [...(interaction.fields?.fields?.keys() || [])]);

            // discord.js 14.25.1 解析 FileUpload attachments
            let uploadedCollection = null;
            try {
                uploadedCollection = interaction.fields.getUploadedFiles('file_upload_input', false);
            } catch (e) {
                console.log('[UploadWizard] getUploadedFiles 异常:', e.message);
            }

            console.log('[UploadWizard] uploadedCollection:', uploadedCollection);

            if (uploadedCollection && uploadedCollection.size > 0) {
                // 存储多个文件
                state.files = [];
                for (const [, att] of uploadedCollection) {
                    state.files.push({
                        url: att.url,
                        name: att.name,
                        contentType: att.contentType || null
                    });
                }
                // 导出属性兕容旧代码
                state.file_url = state.files[0].url;
                state.file_name = state.files.map(f => f.name).join(', ');
                state.file_content_type = state.files[0].contentType;
                console.log(`[UploadWizard] 文件已读取 (${state.files.length} 个): ${state.file_name}`);
            } else {
                // Fallback: 尝试从 raw resolved 读取
                const rawData = interaction.data;
                if (rawData?.resolved?.attachments) {
                    const attachmentMap = rawData.resolved.attachments;
                    state.files = Object.values(attachmentMap).map(att => ({
                        url: att.url,
                        name: att.filename || att.url.split('/').pop(),
                        contentType: att.content_type || null
                    }));
                    state.file_url = state.files[0]?.url;
                    state.file_name = state.files.map(f => f.name).join(', ');
                    state.file_content_type = state.files[0]?.contentType;
                    console.log(`[UploadWizard] 文件已从 raw 读取 (${state.files.length} 个): ${state.file_name}`);
                } else {
                    console.log('[UploadWizard] 未找到上传的文件。调试信息:', {
                        hasData: !!rawData,
                        hasResolved: !!(rawData?.resolved),
                        resolvedKeys: rawData?.resolved ? Object.keys(rawData.resolved) : [],
                        fieldsComponents: interaction.fields?.components?.length
                    });
                }
            }
        }

        await interaction.update(this.buildWizardPayload(stateId));
        return true;
    }
}

module.exports = new UploadWizardHandler();
