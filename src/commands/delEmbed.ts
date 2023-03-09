import { Message, SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("del")
        .setDescription("Deletes the most recent embed sent by the bot"),
    async execute(interaction: any) {
        const channel = interaction.channel;

        const messages = await channel.messages.fetch({
            limit: 3,
            cache: false,
        });

        for (const msg of messages.values()) {
            console.log(msg);

            if (msg.author.username === "WYFI") {
                if (msg.embeds[0]) {
                    console.log(`deleting embedded message: ${msg}`);
                    msg.delete();
                    break;
                }
            }
        }
        channel.send();
        interaction.reply({ content: "Message deleted", ephemeral: true });
    },
};
