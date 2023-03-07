import { SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription("Identifies user"),
    async execute(interaction: any) {
        interaction.reply({
            content: `Hello, ${interaction.user.username}. You joined on ${interaction.member.joinedAt}`,
            ephemeral: true,
        });
    },
};
