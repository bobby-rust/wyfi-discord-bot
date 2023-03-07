import { SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("server")
        .setDescription("Provides information about the server."),
    async execute(interaction: any) {
        interaction.reply({
            content: `The server is ${interaction.guild.name} and it has ${interaction.guild.memberCount} members.`,
            ephemeral: true,
        });
    },
};
