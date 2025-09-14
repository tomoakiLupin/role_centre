const fs = require('fs/promises');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendLog } = require('../../utils/logger');

const votesFilePath = path.join(__dirname, '..', '..', 'data', 'votes.json');

// Helper to ensure the votes file exists
async function ensureVotesFile() {
  try {
    await fs.access(votesFilePath);
  } catch (error) {
    await fs.writeFile(votesFilePath, JSON.stringify({}));
  }
}

// Helper to read vote data
async function getVotes() {
  await ensureVotesFile();
  const data = await fs.readFile(votesFilePath, 'utf8');
  return JSON.parse(data);
}

// Helper to save vote data
async function saveVotes(data) {
  await fs.writeFile(votesFilePath, JSON.stringify(data, null, 2));
}

// Called from apply_request_handler.js to start a new vote
async function createVote(client, member, config) {
  const { revive_config, data: configData, guild_id } = config;
  const { review_channel_id } = revive_config;
  const { role_id: targetRoleId } = configData;

  if (!review_channel_id) {
    throw new Error('配置文件中缺少 review_channel_id');
  }

  const reviewChannel = await client.channels.fetch(review_channel_id);
  if (!reviewChannel) {
    throw new Error(`找不到 ID 为 ${review_channel_id} 的审核频道`);
  }

  const voteId = `${Date.now()}-${member.id}`;

  const voteEmbed = new EmbedBuilder()
    .setTitle('身份组申请人工审核')
    .setDescription(`用户 **${member.user.tag}** (${member.id}) 申请获得身份组 <@&${targetRoleId}>，需要投票决定是否批准 `)
    .setColor(0x3498db)
    .addFields(
      { name: '申请人', value: `<@${member.id}>`, inline: true },
      { name: '申请身份组', value: `<@&${targetRoleId}>`, inline: true },
      { name: '当前状态', value: '投票中...', inline: false },
      { name: '👍 同意', value: '管理员: 0/-\\n用户: 0/-', inline: true },
      { name: '👎 拒绝', value: '管理员: 0/-\\n用户: 0/-', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `投票ID: ${voteId}` });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`vote:approve:${voteId}`)
        .setLabel('同意')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👍'),
      new ButtonBuilder()
        .setCustomId(`vote:reject:${voteId}`)
        .setLabel('拒绝')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('👎')
    );

  const voteMessage = await reviewChannel.send({ embeds: [voteEmbed], components: [row] });

  const votes = await getVotes();
  votes[voteId] = {
    messageId: voteMessage.id,
    channelId: reviewChannel.id,
    requesterId: member.id,
    targetRoleId: targetRoleId,
    config: config, // Save the entire config for later use
    status: 'pending',
    votes: {
      approve: [],
      reject: []
    }
  };

  await saveVotes(votes);
  console.log(`[voteManager/createVote] 已为用户 ${member.id} 的申请创建投票，ID: ${voteId}`);

  // Send log
  await sendLog(client, 'info', {
    module: '投票系统',
    operation: '发起投票',
    message: `为用户 <@${member.id}> 的身份组申请 <@&${targetRoleId}> 发起了投票 \\n[点击查看投票](https://discord.com/channels/${guild_id}/${reviewChannel.id}/${voteMessage.id})\\n投票ID: ${voteId}`
  });

  return voteId;
}

// Called from voteHandler.js to check the status after a vote
async function checkVoteStatus(client, voteId) {
  const allVotes = await getVotes();
  const voteData = allVotes[voteId];

  if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
    return;
  }

  const { config, votes, channelId, messageId } = voteData;
  const { revive_config, guild_id } = config;

  if (!revive_config) {
    console.error(`[voteManager/checkVoteStatus] FATAL: 投票数据 ${voteId} 缺少 revive_config 配置 `, { voteData });
    return;
  }
  const { allow_vote_role } = revive_config;
  const { ratio_allow, ratio_reject } = allow_vote_role || {};
  if (!ratio_allow || !ratio_reject || !allow_vote_role) {
    console.error(`[voteManager/checkVoteStatus] FATAL: 投票数据 ${voteId} 的 revive_config 或 allow_vote_role 不完整 `, { revive_config });
    return;
  }

  const guild = await client.guilds.fetch(guild_id);
  if (!guild) {
    console.error(`[voteManager/checkVoteStatus] 无法找到服务器: ${guild_id}`);
    return;
  }

  // Calculate current votes
  let adminApprovals = 0, userApprovals = 0, adminRejections = 0, userRejections = 0;

  for (const userId of votes.approve) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      if (member.roles.cache.has(allow_vote_role.admin)) adminApprovals++;
      else if (member.roles.cache.has(allow_vote_role.user)) userApprovals++;
    }
  }

  for (const userId of votes.reject) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      if (member.roles.cache.has(allow_vote_role.admin)) adminRejections++;
      else if (member.roles.cache.has(allow_vote_role.user)) userRejections++;
    }
  }

  // Check if conditions are met
  const isApprovedByAdmin = ratio_allow.admin > 0 && adminApprovals >= ratio_allow.admin;
  const isApprovedByUser = ratio_allow.user > 0 && userApprovals >= ratio_allow.user;

  const isRejected = (ratio_reject.admin > 0 && adminRejections >= ratio_reject.admin) ||
                     (ratio_reject.user > 0 && userRejections >= ratio_reject.user);

  // If an admin rejects at any time, the vote is immediately rejected.
  if (isRejected) {
    return finalizeVote(client, voteId, 'rejected');
  }

  // If an admin approves, the vote is immediately approved.
  if (isApprovedByAdmin) {
    return finalizeVote(client, voteId, 'approved');
  }

  // If the vote is approved by users and is currently pending, start the admin review period.
  if (isApprovedByUser && voteData.status === 'pending') {
    return startPendingPeriod(client, voteId);
  }

  // If the vote is not over, update the message
  const channel = await guild.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);
  const originalEmbed = message.embeds[0];

  const updatedEmbed = new EmbedBuilder(originalEmbed.toJSON())
    .setFields(
      originalEmbed.fields[0],
      originalEmbed.fields[1],
      { name: '当前状态', value: '投票中...', inline: false },
      { name: '👍 同意', value: `管理员: ${adminApprovals}/${ratio_allow.admin}\\n用户: ${userApprovals}/${ratio_allow.user}`, inline: true },
      { name: '👎 拒绝', value: `管理员: ${adminRejections}/${ratio_reject.admin}\\n用户: ${userRejections}/${ratio_reject.user}`, inline: true }
    );

  await message.edit({ embeds: [updatedEmbed] });
}

// Called when user vote passes, waiting for admin action
async function startPendingPeriod(client, voteId) {
    const allVotes = await getVotes();
    const voteData = allVotes[voteId];

    if (!voteData || voteData.status !== 'pending') {
        return;
    }

    const now = new Date();
    const pendingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    voteData.status = 'pending_admin';
    voteData.pendingUntil = pendingUntil.toISOString();
    await saveVotes(allVotes);

    const { channelId, messageId, config, requesterId, targetRoleId } = voteData;
    const guild = await client.guilds.fetch(config.guild_id);
    const channel = await guild.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    const originalEmbed = message.embeds[0];

    const pendingEmbed = new EmbedBuilder(originalEmbed.toJSON())
        .setColor(0xf1c40f) // Yellow for pending
        .setFields(
            originalEmbed.fields[0], // requester
            originalEmbed.fields[1], // role
            { name: '当前状态', value: `⏳ 等待管理员确认`, inline: false },
            { name: '详情', value: `用户投票已达标 如果在 <t:${Math.floor(pendingUntil.getTime() / 1000)}:R> 内没有管理员拒绝，申请将自动通过 `, inline: false },
            originalEmbed.fields[3], // approve counts
            originalEmbed.fields[4]  // reject counts
        );

    await message.edit({ embeds: [pendingEmbed] });

    console.log(`[voteManager/startPendingPeriod] 投票 ${voteId} 已进入管理员等待期 `);

    // Send log
    await sendLog(client, 'info', {
        module: '投票系统',
        operation: '进入管理员等待期',
        message: `用户 <@${requesterId}> 的申请 <@&${targetRoleId}> 用户投票已达标，进入24小时等待期 \\n[点击查看投票](https://discord.com/channels/${config.guild_id}/${channelId}/${messageId})\\n投票ID: ${voteId}`
    });
}

// Called by checkVoteStatus to finalize the vote
async function finalizeVote(client, voteId, result) {
  const allVotes = await getVotes();
  const voteData = allVotes[voteId];

  if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
    return;
  }

  voteData.status = result;
  if (voteData.pendingUntil) {
    delete voteData.pendingUntil;
  }
  await saveVotes(allVotes);
  const { requesterId, targetRoleId, channelId, messageId, config } = voteData;
  const guild = await client.guilds.fetch(config.guild_id);
  if (!guild) {
    console.error(`[voteManager/finalizeVote] 无法找到服务器: ${config.guild_id}`);
    return;
  }
  const requester = await guild.members.fetch(requesterId).catch(() => null);

  const channel = await guild.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);
  const originalEmbed = message.embeds[0];

  const finalEmbed = new EmbedBuilder(originalEmbed.toJSON());
  const finalComponents = []; // Empty components to disable buttons

  if (result === 'approved') {
    finalEmbed.setColor(0x2ecc71).setFields(
      originalEmbed.fields[0],
      originalEmbed.fields[1],
      { name: '状态', value: '✅ 已通过', inline: false }
    );
    if (requester) {
      await requester.roles.add(targetRoleId);
      try {
        await requester.send(`🎉 恭喜！您在 **${guild.name}** 的身份组申请 **(<@&${targetRoleId}>)** 已通过人工审核 `);
      } catch (e) {
        console.log(`[voteManager/finalizeVote] 无法私信用户 ${requesterId}`);
      }
    }
  } else { // rejected
    finalEmbed.setColor(0xe74c3c).setFields(
      originalEmbed.fields[0],
      originalEmbed.fields[1],
      { name: '状态', value: '❌ 已拒绝', inline: false }
    );
    if (requester) {
      try {
        await requester.send(`很抱歉，您在 **${guild.name}** 的身份组申请 **(<@&${targetRoleId}>)** 未通过人工审核 `);
      } catch (e) {
        console.log(`[voteManager/finalizeVote] 无法私信用户 ${requesterId}`);
      }
    }
  }

  await message.edit({ embeds: [finalEmbed], components: finalComponents });
  console.log(`[voteManager/finalizeVote] 投票 ${voteId} 已结束，结果: ${result}`);

  // Send log
  await sendLog(client, result === 'approved' ? 'success' : 'warning', {
    module: '投票系统',
    operation: '投票结束',
    message: `用户 <@${requesterId}> 的申请投票已结束，结果为 **${result === 'approved' ? '通过' : '拒绝'}** \\n[点击查看投票](https://discord.com/channels/${config.guild_id}/${channelId}/${messageId})\\n投票ID: ${voteId}`
  });
}

module.exports = {
  createVote,
  getVotes,
  saveVotes,
  checkVoteStatus,
  finalizeVote,
  startPendingPeriod
};