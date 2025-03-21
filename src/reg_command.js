require('dotenv').config();
const {REST, Routes} = require('discord.js');

const command = [
    {
        name: 'hey',
        description: 'Replies with hey!'

    },
    {
        name: 'ping',
        description: 'Replies with pong!'
    },
    {
        name: 'in4',
        description: 'Sends an embed!'
    }
];

const rest = new REST({version: '10'}).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');

        // Register the slash commands
        await rest.put(
            Routes.applicationGuildCommands(process.env.DIS_CLIENT_ID, process.env.DIS_GUILD_ID),
            {body: command}
        )

        console.log('Slash commands were registered successfully!');
    } catch (err) {
        console.log(`Error: ${err}`);
    }
})();