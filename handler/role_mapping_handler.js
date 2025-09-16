const { config } = require('../config/config');
const FileEditor = require('../utils/file_editor');
const path = require('path');

/**
 * 根据配置自动更新身份组映射文件 (role_mapping.json) 中特定服务器的身份组列表
 * @param {import('discord.js').Client} client - Discord 客户端实例
 */
async function generateRoleMappingFile(client) {
  console.log('[RoleMapping] 开始更新身份组映射...');

  const roleMappingSetup = config.get('bot.other.roleid_mapping_setup');
  if (!roleMappingSetup) {
    console.log('[RoleMapping] 未找到 roleid_mapping_setup 配置，跳过更新');
    return;
  }

  const roleMappingFilePath = path.join(__dirname, '..', 'data', 'role_mapping.json');
  const fileEditor = new FileEditor(roleMappingFilePath);

  try {
    await fileEditor.atomic_write(async (currentMapping) => {
      if (!currentMapping) {
        console.warn('[RoleMapping] 无法读取现有的 role_mapping.json，将创建一个新文件');
        currentMapping = {}; // 如果文件不存在，则从一个空对象开始
      }

      for (const guildId in roleMappingSetup) {
        const setup = roleMappingSetup[guildId];
        const { start_roleid, end_roleid } = setup;

        if (!start_roleid || !end_roleid) {
          console.warn(`[RoleMapping] 服务器 ${guildId} 的 start_roleid 或 end_roleid 未配置，已跳过`);
          continue;
        }

        // 在 role_mapping.json 中找到与当前 guildId 匹配的条目
        const mappingKey = Object.keys(currentMapping).find(
          key => currentMapping[key].guild_id === guildId
        );

        if (!mappingKey) {
          console.warn(`[RoleMapping] 在 role_mapping.json 中未找到 guild_id 为 ${guildId} 的配置条目，已跳过`);
          continue;
        }

        try {
          const guild = await client.guilds.fetch(guildId);
          const roles = await guild.roles.fetch();
          const startRole = roles.get(start_roleid);
          const endRole = roles.get(end_roleid);

          if (!startRole || !endRole) {
            console.warn(`[RoleMapping] 在服务器 ${guildId} 中找不到起始或结束身份组，已跳过`);
            continue;
          }

          const startPosition = startRole.position;
          const endPosition = endRole.position;

          if (startPosition <= endPosition) {
            console.warn(`[RoleMapping] 在服务器 ${guildId} 中，起始身份组的位置必须高于结束身份组，已跳过`);
            continue;
          }

          const filteredRoles = roles
            .filter(role => role.position < startPosition && role.position > endPosition)
            .sort((a, b) => b.position - a.position);

          const newRoleData = {};
          filteredRoles.forEach(role => {
            newRoleData[role.id] = role.name;
          });

          // 只更新 data 字段，保留其他元数据
          currentMapping[mappingKey].data = newRoleData;
          console.log(`[RoleMapping] ✓ 已为服务器 ${guild.name} (${guildId}) 更新了 ${filteredRoles.size} 个身份组映射`);

        } catch (error) {
          console.error(`[RoleMapping] 处理服务器 ${guildId} 时出错:`, error);
        }
      }
      
      // 返回更新后的整个映射对象
      return currentMapping;
    });

    console.log(`[RoleMapping] ✓ 身份组映射文件更新完成: ${roleMappingFilePath}`);

  } catch (error) {
    console.error(`[RoleMapping] ✗ 更新身份组映射文件时发生严重错误:`, error);
  }
}

module.exports = { generateRoleMappingFile };