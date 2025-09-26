class VotePermissionManager {
    static checkVotePermission(member, voteData, action) {
        const debugId = `perm-${member.id}-${Date.now()}`;
        console.log(`[VotePermissionManager] [${debugId}] 开始权限检查: user=${member.user.tag} (${member.id}), action=${action}`);

        if (!member || !member.id || !member.user) {
            console.error(`[VotePermissionManager] [${debugId}] 无效的成员对象:`, member);
            return {
                allowed: false,
                reason: '无效的用户信息'
            };
        }

        if (!voteData || !voteData.config) {
            console.error(`[VotePermissionManager] [${debugId}] 无效的投票数据:`, voteData);
            return {
                allowed: false,
                reason: '无效的投票数据'
            };
        }

        const { config, status, requesterId } = voteData;
        const { allow_vote_role } = config.revive_config;

        console.log(`[VotePermissionManager] [${debugId}] 投票信息: status=${status}, requesterId=${requesterId}, allowVoteRole=`, allow_vote_role);

        // 申请人不能为自己投票
        if (member.id === requesterId) {
            console.warn(`[VotePermissionManager] [${debugId}] 申请人试图为自己投票`);
            return {
                allowed: false,
                reason: '申请人不能为自己投票'
            };
        }

        // 检查投票角色配置是否存在
        if (!allow_vote_role || !allow_vote_role.admin || !allow_vote_role.user) {
            console.error(`[VotePermissionManager] [${debugId}] 投票角色配置不完整:`, allow_vote_role);
            return {
                allowed: false,
                reason: '投票角色配置错误'
            };
        }

        // 根据投票状态检查权限
        let result;
        switch (status) {
            case 'pending':
                console.log(`[VotePermissionManager] [${debugId}] 检查普通投票权限`);
                result = this.checkPendingVotePermission(member, allow_vote_role, action);
                break;
            case 'pending_admin':
                console.log(`[VotePermissionManager] [${debugId}] 检查管理员投票权限`);
                result = this.checkAdminVotePermission(member, allow_vote_role, action);
                break;
            case 'approved':
            case 'rejected':
                console.warn(`[VotePermissionManager] [${debugId}] 投票已结束: ${status}`);
                result = {
                    allowed: false,
                    reason: '投票已结束'
                };
                break;
            default:
                console.error(`[VotePermissionManager] [${debugId}] 未知的投票状态: ${status}`);
                result = {
                    allowed: false,
                    reason: '未知的投票状态'
                };
                break;
        }

        console.log(`[VotePermissionManager] [${debugId}] 权限检查结果:`, result);
        return result;
    }

    static checkPendingVotePermission(member, allowVoteRole, action) {
        const debugId = `pending-${member.id}-${Date.now()}`;
        console.log(`[VotePermissionManager] [${debugId}] 检查普通投票权限: admin=${allowVoteRole.admin}, user=${allowVoteRole.user}`);

        let isAdmin = false;
        let isUser = false;

        try {
            isAdmin = member.roles.cache.has(String(allowVoteRole.admin));
            isUser = member.roles.cache.has(String(allowVoteRole.user));
            console.log(`[VotePermissionManager] [${debugId}] 角色检查: isAdmin=${isAdmin}, isUser=${isUser}`);
        } catch (error) {
            console.error(`[VotePermissionManager] [${debugId}] 角色检查失败:`, error);
            return {
                allowed: false,
                reason: '无法检查用户角色，请稍后重试'
            };
        }

        if (!isAdmin && !isUser) {
            console.warn(`[VotePermissionManager] [${debugId}] 用户没有投票权限`);
            return {
                allowed: false,
                reason: '您没有权限参与本次投票'
            };
        }

        // 在普通投票阶段，管理员和用户都可以投票
        console.log(`[VotePermissionManager] [${debugId}] 普通投票权限允许`);
        return {
            allowed: true,
            isAdmin,
            isUser
        };
    }

    static checkAdminVotePermission(member, allowVoteRole, action) {
        const debugId = `admin-${member.id}-${Date.now()}`;
        console.log(`[VotePermissionManager] [${debugId}] 检查管理员投票权限: admin=${allowVoteRole.admin}, action=${action}`);

        let isAdmin = false;

        try {
            isAdmin = member.roles.cache.has(String(allowVoteRole.admin));
            console.log(`[VotePermissionManager] [${debugId}] 管理员角色检查: isAdmin=${isAdmin}`);
        } catch (error) {
            console.error(`[VotePermissionManager] [${debugId}] 管理员角色检查失败:`, error);
            return {
                allowed: false,
                reason: '无法检查管理员角色，请稍后重试'
            };
        }

        if (!isAdmin) {
            console.warn(`[VotePermissionManager] [${debugId}] 非管理员试图在管理员确认阶段操作`);
            return {
                allowed: false,
                reason: '当前为管理员确认阶段，只有管理员可以操作'
            };
        }

        console.log(`[VotePermissionManager] [${debugId}] 管理员权限允许`);
        return {
            allowed: true,
            isAdmin: true
        };
    }

    // 检查用户是否可以修改已有投票
    static checkVoteChangePermission(member, voteData, currentVote) {
        const { status } = voteData;

        // 管理员确认阶段不允许修改投票
        if (status === 'pending_admin') {
            return {
                allowed: false,
                reason: '管理员确认阶段不允许修改投票'
            };
        }

        // 普通投票阶段允许修改投票
        if (status === 'pending') {
            return {
                allowed: true,
                canRetract: true // 可以撤销投票
            };
        }

        return {
            allowed: false,
            reason: '当前状态不允许修改投票'
        };
    }

    // 检查管理员终局权
    static checkAdminFinalVote(member, voteData) {
        const { config, status } = voteData;
        const { allow_vote_role } = config.revive_config;
        const isAdmin = member.roles.cache.has(String(allow_vote_role.admin));

        if (!isAdmin) {
            return {
                isFinalVote: false
            };
        }

        // 在管理员确认阶段，管理员的任何投票都是终局性的
        if (status === 'pending_admin') {
            return {
                isFinalVote: true,
                reason: '管理员确认阶段的投票是终局性的'
            };
        }

        // 在基础投票阶段，管理员的任何操作都不是终局性的
        return {
            isFinalVote: false,
            adminRejectIsFinal: false
        };
    }

    // 获取用户角色类型
    static getUserRoleType(member, allowVoteRole) {
        const isAdmin = member.roles.cache.has(String(allowVoteRole.admin));
        const isUser = member.roles.cache.has(String(allowVoteRole.user));

        if (isAdmin) return 'admin';
        if (isUser) return 'user';
        return 'none';
    }

    // 检查投票阈值是否达成
    static checkVoteThreshold(votes, allowVoteRole, guild) {
        return new Promise(async (resolve) => {
            try {
                // 统计当前票数
                let adminApprovals = 0, userApprovals = 0;
                let adminRejections = 0, userRejections = 0;

                // 统计同意票
                for (const userId of votes.approve || []) {
                    try {
                        const member = await guild.members.fetch(userId);
                        if (member.roles.cache.has(String(allowVoteRole.admin))) {
                            adminApprovals++;
                        } else if (member.roles.cache.has(String(allowVoteRole.user))) {
                            userApprovals++;
                        }
                    } catch (error) {
                        console.warn(`[VotePermissionManager] 无法获取用户 ${userId}:`, error.message);
                    }
                }

                // 统计拒绝票
                for (const userId of votes.reject || []) {
                    try {
                        const member = await guild.members.fetch(userId);
                        if (member.roles.cache.has(String(allowVoteRole.admin))) {
                            adminRejections++;
                        } else if (member.roles.cache.has(String(allowVoteRole.user))) {
                            userRejections++;
                        }
                    } catch (error) {
                        console.warn(`[VotePermissionManager] 无法获取用户 ${userId}:`, error.message);
                    }
                }

                const { ratio_allow, ratio_reject } = allowVoteRole;

                // 检查是否达到通过阈值
                const adminApprovalMet = ratio_allow.admin > 0 && adminApprovals >= ratio_allow.admin;
                const userApprovalMet = ratio_allow.user > 0 && userApprovals >= ratio_allow.user;

                // 检查是否达到拒绝阈值
                const adminRejectionMet = ratio_reject.admin > 0 && adminRejections >= ratio_reject.admin;
                const userRejectionMet = ratio_reject.user > 0 && userRejections >= ratio_reject.user;

                resolve({
                    counts: {
                        adminApprovals,
                        userApprovals,
                        adminRejections,
                        userRejections
                    },
                    thresholds: {
                        adminApprovalMet,
                        userApprovalMet,
                        adminRejectionMet,
                        userRejectionMet
                    },
                    shouldApprove: adminApprovalMet || userApprovalMet,
                    shouldReject: adminRejectionMet || userRejectionMet,
                    adminRejected: adminRejectionMet
                });
            } catch (error) {
                console.error('[VotePermissionManager] 检查投票阈值时出错:', error);
                resolve({
                    error: error.message,
                    shouldApprove: false,
                    shouldReject: false
                });
            }
        });
    }
}

module.exports = VotePermissionManager;