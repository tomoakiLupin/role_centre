class VotePermissionManager {
    static checkVotePermission(member, voteData, action) {
        const { config, status, requesterId } = voteData;
        const { allow_vote_role } = config.revive_config;

        // 申请人不能为自己投票
        if (member.id === requesterId) {
            return {
                allowed: false,
                reason: '申请人不能为自己投票'
            };
        }

        // 根据投票状态检查权限
        switch (status) {
            case 'pending':
                return this.checkPendingVotePermission(member, allow_vote_role, action);
            case 'pending_admin':
                return this.checkAdminVotePermission(member, allow_vote_role, action);
            case 'approved':
            case 'rejected':
                return {
                    allowed: false,
                    reason: '投票已结束'
                };
            default:
                return {
                    allowed: false,
                    reason: '未知的投票状态'
                };
        }
    }

    static checkPendingVotePermission(member, allowVoteRole, action) {
        const isAdmin = member.roles.cache.has(String(allowVoteRole.admin));
        const isUser = member.roles.cache.has(String(allowVoteRole.user));

        if (!isAdmin && !isUser) {
            return {
                allowed: false,
                reason: '您没有权限参与本次投票'
            };
        }

        // 在普通投票阶段，管理员和用户都可以投票
        return {
            allowed: true,
            isAdmin,
            isUser
        };
    }

    static checkAdminVotePermission(member, allowVoteRole, action) {
        const isAdmin = member.roles.cache.has(String(allowVoteRole.admin));

        if (!isAdmin) {
            return {
                allowed: false,
                reason: '当前为管理员确认阶段，只有管理员可以操作'
            };
        }

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