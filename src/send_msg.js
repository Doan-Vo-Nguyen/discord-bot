const {Client, IntentsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
require('dotenv').config();
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
  ]
})

const roles = [
  {
    id: '1279385407972446268',
    label: 'HOMIE'
  },
  {
    id: '1279385851486535781',
    label: 'YOUNGER'
  }
]

client.on('ready', async(c) => {
  try {
    const channel = client.channels.cache.get(process.env.ROLES_CHANNEL_ID)
    if (!channel) {
      return;
    }
    const row = new ActionRowBuilder();

    roles.forEach((role) => {
      row.components.push(
        new ButtonBuilder()
        .setCustomId(role.id)
        .setLabel(role.label)
        .setStyle(ButtonStyle.Primary)
      )
    })

    await channel.send({
      content: 'Choose or remove role below',
      components: [row],
    })
    process.exit()
  } catch (error) {
    console.log(error)
  }
})
client.login(process.env.BOT_TOKEN)