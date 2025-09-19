const voteManager = require('./vote_manager');

async function handleVote(interaction) {
  // Defer the reply immediately to avoid "Unknown Interaction"
  await interaction.deferReply({ flags: [64] });

  const [_, action, voteId] = interaction.customId.split(':');
  const voter = interaction.member;
  const voterId = voter.id;

  const voteData = await voteManager.getVote(voteId);

  if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
    return interaction.editReply({ content: '这个投票已结束或不存在 ' });
  }

  const { config } = voteData;
  const { allow_vote_role } = config.revive_config;

  // Permission check based on vote status
  if (voteData.status === 'pending_admin') {
    // In admin confirmation period, only admins can vote
    const isAdmin = voter.roles.cache.has(String(allow_vote_role.admin));
    if (!isAdmin) {
      return interaction.editReply({ content: '当前为管理员确认阶段，只有管理员可以操作 ' });
    }
  } else {
    // In normal voting period, check general permission
    const hasPermission = Object.values(allow_vote_role).some(roleId => voter.roles.cache.has(String(roleId)));
    if (!hasPermission) {
      return interaction.editReply({ content: '你没有权限参与本次投票 ' });
    }
  }

  // Applicant cannot vote for themselves
  if (voterId === voteData.requesterId) {
    return interaction.editReply({ content: '申请人不能为自己投票 ' });
  }

  const { votes } = voteData;
  const oppositeAction = action === 'approve' ? 'reject' : 'approve';

  // In admin confirmation period, no vote changes allowed
  if (voteData.status === 'pending_admin') {
    // Check if admin has already voted in this confirmation period
    const hasAlreadyVoted = votes[action].includes(voterId) || votes[oppositeAction].includes(voterId);
    if (hasAlreadyVoted) {
      return interaction.editReply({ content: '您在管理员确认阶段已经操作过，无法重复操作' });
    }

    // Add the vote directly without removing from opposite
    votes[action].push(voterId);
  } else {
    // Normal voting period - allow vote changes
    // If the user has already voted for the same action, retract the vote
    if (votes[action].includes(voterId)) {
      votes[action] = votes[action].filter(id => id !== voterId);
      await voteManager.saveVote(voteId, voteData);
      await interaction.editReply({ content: '您已撤销投票 ' });
      return voteManager.checkVoteStatus(interaction.client, voteId);
    }

    votes[oppositeAction] = votes[oppositeAction].filter(id => id !== voterId);
    votes[action].push(voterId);
  }

  await voteManager.saveVote(voteId, voteData);

  // Different feedback based on vote status
  if (voteData.status === 'pending_admin') {
    await interaction.editReply({ content: `您已成功 **${action === 'approve' ? '管理确认' : '管理拒绝'}** ` });
  } else {
    await interaction.editReply({ content: `您已成功投出 **${action === 'approve' ? '同意' : '拒绝'}** 票 ` });
  }

  await voteManager.checkVoteStatus(interaction.client, voteId);
}

module.exports = { handleVote };