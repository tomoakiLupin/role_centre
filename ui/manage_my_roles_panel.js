const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class ManageMyRolesPanelUI {
    static createInitialPanel(title, content, imageUrl) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(content)
            .setColor(0x5865F2) // Discord Blurple
            .setTimestamp();

        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        const wearButton = new ButtonBuilder()
            .setCustomId('manage_my_roles:wear_prompt')
            .setLabel('佩戴身份组')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕');

        const removeButton = new ButtonBuilder()
            .setCustomId('manage_my_roles:remove_prompt')
            .setLabel('移除身份组')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('➖');
        
        const viewButton = new ButtonBuilder()
            .setCustomId('manage_my_roles:view:0') // page 0
            .setLabel('查看我的身份组')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👀');

        const row = new ActionRowBuilder().addComponents(wearButton, removeButton, viewButton);

        return {
            embeds: [embed],
            components: [row]
        };
    }

    static createRoleSelectPanel(action, roles) {
        const actionText = action === 'wear' ? '佩戴' : '移除';
        const color = action === 'wear' ? 0x3498db : 0xe74c3c; // Blue or Red

        if (!roles || roles.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('提示')
                .setDescription(`您当前没有可 ${actionText} 的身份组`)
                .setColor(0xf1c40f); // Yellow
            return { embeds: [embed], components: [], flags: [64] };
        }

        const embed = new EmbedBuilder()
            .setTitle(`${actionText}身份组`)
            .setDescription(`请从下面的菜单中选择您想${actionText}的身份组`)
            .setColor(color)
            .setFooter({ text: '此消息将在3分钟后失效' });

        const options = roles.map(role => ({
            label: role.name,
            value: role.id,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`manage_my_roles:${action}_select`)
            .setPlaceholder(`✨ 选择要${actionText}的身份组...`)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return { embeds: [embed], components: [row], flags: [64] };
    }

    static createViewRolesPanel(user, roles, page = 0) {
        const rolesPerPage = 10;
        const startIndex = page * rolesPerPage;
        const paginatedRoles = roles.slice(startIndex, startIndex + rolesPerPage);

        const embed = new EmbedBuilder()
            .setTitle(`${user.username} 拥有的身份组 (第 ${page + 1} 页)`)
            .setColor(0x95a5a6) // Grey
            .setTimestamp();

        if (paginatedRoles.length > 0) {
            const roleList = paginatedRoles.map(role => `• ${role.name}`).join('\n');
            embed.setDescription(roleList);
        } else {
            embed.setDescription('您当前未佩戴任何通过此系统获取的身份组');
        }

        const components = [];
        const navigationRow = new ActionRowBuilder();
        if (page > 0) {
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`manage_my_roles:view:${page - 1}`)
                    .setLabel('上一页')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        if ((startIndex + rolesPerPage) < roles.length) {
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`manage_my_roles:view:${page + 1}`)
                    .setLabel('下一页')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        if (navigationRow.components.length > 0) {
            components.push(navigationRow);
        }

        return { embeds: [embed], components, flags: [64] };
    }

    static createFeedback(action, roleName, success = true) {
        const embed = new EmbedBuilder()
            .setTitle(success ? `✅ 操作成功` : `❌ 操作失败`)
            .setDescription(success ? `您已成功 **${action === 'wear' ? '佩戴' : '卸下'}** \`${roleName}\` 身份组` : `操作失败，请联系管理员`)
            .setColor(success ? 0x00ff00 : 0xff0000)
            .setTimestamp();

        return { embeds: [embed], components: [], flags: [64] };
    }
}

module.exports = ManageMyRolesPanelUI;