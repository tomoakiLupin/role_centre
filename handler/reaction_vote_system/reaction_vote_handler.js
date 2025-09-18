const { handleReaction, initializeVoteFile } = require('./reaction_vote_manager');

function setupReactionVoteHandlers(client) {
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        // Fetch partials
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        await handleReaction(client, reaction, user, 'add');
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        // Fetch partials
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        await handleReaction(client, reaction, user, 'remove');
    });

    client.on('threadCreate', async (thread) => {
        await initializeVoteFile(thread);
    });
}

module.exports = {
    setupReactionVoteHandlers
};