const fs = require('fs').promises;
const path = require('path');

const sourceFilePath = path.join(__dirname, '..', 'data', 'role_assignments.json');
const destinationFilePath = path.join(__dirname, '..', 'data', 'user_roles_by_guild.json');

/**
 * Reads the role assignments file, transforms the data to be grouped by guild and then user,
 * and writes the result to a new JSON file.
 */
async function convertRoleAssignments() {
    try {
        // 1. Read the source file
        const fileContent = await fs.readFile(sourceFilePath, 'utf8');
        const assignments = JSON.parse(fileContent);

        const userRolesByGuild = {};

        if (!assignments || typeof assignments !== 'object') {
            return;
        }

        // 2. Process each operation in the assignments array
        // We use Object.values or iterate if it's an array to avoid "is not iterable"
        const operations = Array.isArray(assignments) ? assignments : Object.entries(assignments);

        for (const operation of operations) {
            const operationData = operation[1];
            if (!operationData || !operationData.data) continue;

            for (const record of operationData.data) {
                const { guild_id, role_ids, assigned_user_ids } = record;

                if (!guild_id || !role_ids || !assigned_user_ids) continue;

                // Initialize guild object if it doesn't exist
                if (!userRolesByGuild[guild_id]) {
                    userRolesByGuild[guild_id] = {};
                }

                // Assign roles to each user in the current record
                for (const userId of assigned_user_ids) {
                    // Initialize user's role array if it doesn't exist
                    if (!userRolesByGuild[guild_id][userId]) {
                        userRolesByGuild[guild_id][userId] = [];
                    }

                    // Add new roles, ensuring no duplicates
                    for (const roleId of role_ids) {
                        if (!userRolesByGuild[guild_id][userId].includes(roleId)) {
                            userRolesByGuild[guild_id][userId].push(roleId);
                        }
                    }
                }
            }
        }

        // 3. Write the transformed data to the destination file
        await fs.writeFile(destinationFilePath, JSON.stringify(userRolesByGuild, null, 4));
        console.log(`Successfully converted and saved role assignments to ${destinationFilePath}`);

    } catch (error) {
        console.error('Error during role assignment conversion:', error);
    }
}

module.exports = {
    convertRoleAssignments,
};