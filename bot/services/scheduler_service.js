const cron = require('node-cron');
const { convertRoleAssignments } = require('../../utils/role_assignment_converter');
const { scanAndProcess } = require('../../task/role_fade_task');
const { scanActiveThreads } = require('../../task/reaction_vote_scanner');
const { scanAndAutoApproveVotes } = require('../../task/vote_auto_approve_task');
const { checkExpiredVotes } = require('../../task/vote_expiration_task');
 
 /**
  * Initializes and starts the scheduled tasks for the bot.
  * @param {import('discord.js').Client} client - The Discord client.
  */
 function startScheduledTasks(client) {
     const timezone = "Asia/Shanghai";
 
     // Schedule tasks to run at 4:00 AM every day.
     cron.schedule('0 4 * * *', () => {
         console.log('Running daily 4:00 AM tasks: convertRoleAssignments and scanActiveThreads');
         convertRoleAssignments();
         scanActiveThreads(client);
     }, {
         scheduled: true,
         timezone: timezone
     });
 
     // Schedule the role fade task to run every 3 hours.
     cron.schedule('0 */3 * * *', () => {
         console.log('Running scheduled task: scanAndProcess for role fade');
         scanAndProcess(client);
     }, {
         scheduled: true,
         timezone: timezone
     });
 
     // Schedule the vote auto-approval scan to run every hour.
     cron.schedule('0 * * * *', () => {
         console.log('Running hourly task: scanAndAutoApproveVotes');
         scanAndAutoApproveVotes(client);
     }, {
         scheduled: true,
         timezone: timezone
     });
 
     // Schedule the vote expiration scan to run every hour.
     cron.schedule('0 * * * *', () => {
         console.log('Running hourly task: checkExpiredVotes');
         checkExpiredVotes(client);
     }, {
         scheduled: true,
         timezone: timezone
     });
 
     console.log('Scheduler service started. Daily tasks at 4:00 AM. Role fade scan every 3 hours. Vote auto-approval and expiration scan every hour.');
 }

module.exports = {
    startScheduledTasks,
};