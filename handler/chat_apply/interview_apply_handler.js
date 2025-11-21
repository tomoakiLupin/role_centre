const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { config } = require('../../config/config');

class InterviewApplyHandler {
    async handleButton(interaction) {
        const [, configId] = interaction.customId.split(':');
        const guildConfig = config.get(`chat_Apply.${interaction.guildId}`);

        if (!guildConfig || !guildConfig.data[configId] || !guildConfig.data[configId].choose) {
            return interaction.reply({ content: '❌ 此申请面板的配置无效或不完整。', ephemeral: true });
        }

        const chooseOptions = Object.values(guildConfig.data[configId].choose);
        if (chooseOptions.length === 0) {
            return interaction.reply({ content: '❌ 此申请没有可用的身份组选项。', ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`interview_role_select:${configId}`)
            .setPlaceholder('请选择您想申请的身份组')
            .addOptions(chooseOptions.map(opt => ({
                label: opt.name,
                value: opt.role_id,
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '请从下面的菜单中选择您要申请的身份组。',
            components: [row],
            ephemeral: true
        });
    }

    async handleSelectMenu(interaction) {
        const [, configId] = interaction.customId.split(':');
        const selectedRoleId = interaction.values[0];
        const member = interaction.member;

        const guildConfig = config.get(`chat_Apply.${interaction.guildId}`);
        const roleConfig = guildConfig?.data[configId]?.role_config;

        if (roleConfig && roleConfig.musthold_role_id) {
            if (!member.roles.cache.has(roleConfig.musthold_role_id)) {
                return interaction.reply({ content: `❌ 您需要拥有 <@&${roleConfig.musthold_role_id}> 身份才能申请。`, ephemeral: true });
            }
        }

        const modal = new ModalBuilder()
            .setCustomId(`interview_modal:${configId}:${selectedRoleId}`)
            .setTitle('面谈申请');

        const introductionInput = new TextInputBuilder()
            .setCustomId('introduction')
            .setLabel('个人介绍')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('请简单介绍一下您自己，以及您申请该身份组的原因。')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(introductionInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    async handleModalSubmit(interaction) {
        const [, configId, roleId] = interaction.customId.split(':');
        const introduction = interaction.fields.getTextInputValue('introduction');

        const guildConfig = config.get(`chat_Apply.${interaction.guildId}`);
        const panelConfig = guildConfig?.data[configId];

        if (!panelConfig || !panelConfig.admin_channle_id) {
            return interaction.reply({ content: '❌ 无法处理您的申请，管理员频道未配置。', ephemeral: true });
        }

        const adminChannel = await interaction.guild.channels.fetch(panelConfig.admin_channle_id).catch(() => null);
        if (!adminChannel) {
            return interaction.reply({ content: '❌ 无法找到管理员审核频道，请联系管理员。', ephemeral: true });
        }

        const roleName = panelConfig.choose[roleId]?.name || '未知身份';

        const embed = new EmbedBuilder()
            .setTitle('新的面谈申请')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields(
                { name: '申请人', value: `${interaction.user} (${interaction.user.id})`, inline: true },
                { name: '申请身份组', value: `${roleName} (<@&${roleId}>)`, inline: true },
                { name: '个人介绍', value: introduction }
            )
            .setColor('#FFD700')
            .setTimestamp();

        const approveButton = new ButtonBuilder()
            .setCustomId(`interview_approve:${configId}:${interaction.user.id}:${roleId}`)
            .setLabel('批准')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(`interview_reject:${interaction.user.id}`)
            .setLabel('拒绝')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);

        try {
            await adminChannel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ 您的申请已成功提交，请等待管理员审核。', ephemeral: true });
        } catch (error) {
            console.error('发送申请到管理员频道时出错:', error);
            await interaction.reply({ content: '❌ 提交申请时发生错误，请稍后重试。', ephemeral: true });
        }
    }
}

module.exports = new InterviewApplyHandler();