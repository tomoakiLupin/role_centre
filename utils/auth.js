const { config } = require('../config/config');

const PERMISSION_LEVELS = {
  NONE: 0,
  USER: 1,
  ADMIN: 2,
  DEVELOPER: 3,
};

/**
 * 根据用户ID和角色ID获取权限等级
 * @param {string} userId - 用户的Discord ID
 * @param {string[]} roleIds - 用户持有的角色ID数组
 * @returns {number} - 用户的权限等级
 */
function getPermissionLevel(userId, roleIds = []) {
  if (!userId && (!roleIds || roleIds.length === 0)) {
    return PERMISSION_LEVELS.NONE;
  }

  const developers = config.get('bot.main_config.safety_setting.developers_userid', []);
  if (developers.includes(userId)) {
    return PERMISSION_LEVELS.DEVELOPER;
  }

  const adminRoles = config.get('bot.main_config.safety_setting.admin_roleid', []);
  if (roleIds.some(roleId => adminRoles.includes(roleId))) {
    return PERMISSION_LEVELS.ADMIN;
  }

  const userRoles = config.get('bot.main_config.safety_setting.user_roleid', []);
  if (roleIds.some(roleId => userRoles.includes(roleId))) {
    return PERMISSION_LEVELS.USER;
  }

  return PERMISSION_LEVELS.NONE;
}

module.exports = {
  getPermissionLevel,
  PERMISSION_LEVELS,
};