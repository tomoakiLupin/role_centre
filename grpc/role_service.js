const fs = require('fs');
const path = require('path');

const roleAssignments = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/role_assignments.json'), 'utf8'));
const roleMapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/role_mapping.json'), 'utf8'));
const userRolesByGuild = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/user_roles_by_guild.json'), 'utf8'));
const batchRoleAssignHandler = require('../handler/batch_role_assign_handler');
const { assignRoleToUser } = require('../utils/role_manager');

const roleService = {
  getUserRoles: (call, callback) => {
    const { user_id, guild_id } = call.request;
    const userRoles = userRolesByGuild[guild_id]?.[user_id] || [];
    const roles = userRoles.map(roleId => {
      const roleName = roleMapping[roleId] || 'Unknown Role';
      return { id: roleId, name: roleName };
    });
    callback(null, { roles });
  },
  getRoleAssignments: (call, callback) => {
    const { role_id, guild_id } = call.request;
    const assignments = roleAssignments[guild_id]?.[role_id] || [];
    const users = assignments.map(assignment => ({
      user_id: assignment.user_id,
      assigned_at: assignment.assigned_at,
    }));
    callback(null, { users });
  },

  assignRole: async (call, callback) => {
    const { user_id, guild_id, role_id, operator_id } = call.request;

    try {
      if (operator_id) {
        // 使用 BatchRoleAssignHandler 的逻辑
        if (!global.client) {
          throw new Error('global.client is not available for batch operation.');
        }
        const guild = await global.client.guilds.fetch(guild_id);
        const role = await guild.roles.fetch(role_id);

        if (!guild || !role) {
          throw new Error('Guild or Role not found for batch operation.');
        }

        const result = await batchRoleAssignHandler.processRoleAssignment({
          operationId: operator_id,
          userIds: [user_id],
          // 对应参数在传入 操作 ID 后系统会直接服用对应的操作 ID 的配置
          guild: guild,
        });

        callback(null, { success: true, message: `Batch operation processed with operation ID: ${result.finalOperationId}` });

      } else {
        // 使用基础的身份组分配逻辑
        const result = await assignRoleToUser({
          userId: user_id,
          guildId: guild_id,
          roleId: role_id,
        });
        callback(null, { success: result.success, message: result.message });
      }
    } catch (error) {
      console.error('[gRPC assignRole] Error:', error);
      callback(null, { success: false, message: `An error occurred: ${error.message}` });
    }
  },
};

module.exports = roleService;