const cron = require('node-cron');
const { convertRoleAssignments } = require('../../utils/role_assignment_converter');
const { scanAndProcess } = require('../../task/role_fade_task');
 
 /**
  * Initializes and starts the scheduled tasks for the bot.
  * @param {import('discord.js').Client} client - The Discord client.
  */
 function startScheduledTasks(client) {
     // Schedule the role assignment conversion to run at 4:00 AM every day.
     // The cron pattern '0 4 * * *' means:
    // - 0: at the 0th minute
    // - 4: of the 4th hour
    // - *: every day of the month
    // - *: every month
    // - *: every day of the week
    cron.schedule('0 4 * * *', () => {
        console.log('Running scheduled task: convertRoleAssignments');
        convertRoleAssignments();
    }, {
        scheduled: true,
        timezone: "Asia/Shanghai" // You can adjust the timezone if needed
    });

   // Schedule the role fade task to run every 3 hours.
   cron.schedule('0 */3 * * *', () => {
       console.log('Running scheduled task: scanAndProcess for role fade');
       scanAndProcess(client);
   }, {
       scheduled: true,
       timezone: "Asia/Shanghai"
   });

    console.log('Scheduler service started. Role assignment conversion is scheduled for 4:00 AM daily. Role fade scan is scheduled for every 3 hours.');
}

module.exports = {
    startScheduledTasks,
};