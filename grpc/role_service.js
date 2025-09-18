const fs = require('fs');
const path = require('path');

const roleAssignments = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/role_assignments.json'), 'utf8'));
const roleMapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/role_mapping.json'), 'utf8'));
const userRolesByGuild = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/user_roles_by_guild.json'), 'utf8'));

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
};

module.exports = roleService;