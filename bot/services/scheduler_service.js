const cron = require('node-cron');
const { convertRoleAssignments } = require('../../utils/role_assignment_converter');

/**
 * Initializes and starts the scheduled tasks for the bot.
 */
function startScheduledTasks() {
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

    console.log('Scheduler service started. Role assignment conversion is scheduled for 4:00 AM daily.');
}

module.exports = {
    startScheduledTasks,
};