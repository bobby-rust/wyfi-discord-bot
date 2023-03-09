import { ButtonStyle } from "discord.js";

import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
} from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Creates an embed"),
    async execute(interaction: any) {
        const channel = interaction.channel;
        // inside a command, event listener, etc.
        const exampleEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("Some title")
            .setURL("https://discord.js.org/")
            .setAuthor({
                name: "Some name",
                iconURL: "https://i.imgur.com/AfFp7pu.png",
                url: "https://discord.js.org",
            })
            .setDescription("Some description here")
            .setThumbnail("https://i.imgur.com/AfFp7pu.png")
            .addFields(
                { name: "Regular field title", value: "Some value here" },
                { name: "\u200B", value: "\u200B" },
                {
                    name: "Inline field title",
                    value: "Some value here",
                    inline: true,
                },
                {
                    name: "Inline field title",
                    value: "Some value here",
                    inline: true,
                }
            )
            .addFields({
                name: "Inline field title",
                value: "Some value here",
                inline: true,
            })
            .setImage("https://i.imgur.com/AfFp7pu.png")
            .setTimestamp()
            .setFooter({
                text: "Some footer text here",
                iconURL: "https://i.imgur.com/AfFp7pu.png",
            });
        // Create UI
        const button = new ButtonBuilder()
            .setCustomId("stop_button")
            .setLabel("Stop")
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        // channel.send({ embeds: [exampleEmbed] });
        interaction.reply({ embeds: [exampleEmbed], components: [row] });
    },
};
