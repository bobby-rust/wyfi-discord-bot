import { SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hello")
        .setDescription("Replies with Hello, world!"),
    async execute(interaction: any) {
        await interaction.reply({ content: "Hello, world!", ephemeral: true });
    },
};
