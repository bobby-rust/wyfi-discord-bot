import {
    SlashCommandBuilder,
    Guild,
    GuildScheduledEventCreateOptions,
    GuildScheduledEventPrivacyLevel,
    GuildScheduledEventEntityType,
} from "discord.js";

import { scrape_ufc } from "../scraping/scrape_ufc";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ce")
        .setDescription(
            "Creates a server event for the soonest upcoming UFC event."
        )
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription(
                    'The type of event to create. The only option currently is "UFC".'
                )
                .setRequired(true)
        ),
    // .addStringOption((option) =>
    //     option
    //         .setName("name")
    //         .setDescription("The name of the event.")
    //         .setRequired(true)
    // )
    // .addStringOption((option) =>
    //     option
    //         .setName("date")
    //         .setDescription("The date of the event in YYYY-MM-DD format.")
    //         .setRequired(true)
    // )
    // .addStringOption((option) =>
    //     option
    //         .setName("time")
    //         .setDescription("The time of the event in HH-MM 24h format.")
    //         .setRequired(false)
    // )
    // .addStringOption((option) =>
    //     option
    //         .setName("location")
    //         .setDescription("The location of the event.")
    //         .setRequired(false)
    // ),
    async execute(interaction: any) {
        const guild: Guild = interaction.guild;
        let channel = interaction.channel;

        const voiceChannels = guild.channels.cache;

        voiceChannels.forEach((c) => {
            if (c.type === 2) {
                if (c.name === "General") {
                    channel = c;
                    return;
                }
            }
        });

        if (interaction.options.getString("type").toLowerCase() !== "ufc") {
            await interaction.editReply({
                content:
                    "Create event cancelled. Currently only UFC events are supported.",
                ephemeral: true,
            });
            return;
        }

        const eventInfo = await scrape_ufc();

        const eventParams: GuildScheduledEventCreateOptions = {
            name: eventInfo.headline.headline,
            scheduledStartTime: eventInfo.date.date + " " + eventInfo.date.time,
            image: eventInfo.imgUrl,
            description: eventInfo.headline.headline,
            privacyLevel: 2 as GuildScheduledEventPrivacyLevel,
            entityType: 2 as GuildScheduledEventEntityType,
            channel: channel.id,
        };

        // Check for duplicate event
        const events = guild.scheduledEvents.cache;
        for (const value of events.values()) {
            if (value.name === eventParams.name) {
                interaction.editReply({
                    content: "This event already exists",
                    ephemeral: true,
                });
                return;
            }
        }

        // No duplicate, create event
        const event = await guild.scheduledEvents.create(eventParams);

        await interaction.editReply(`Event created: ${event.name}`);
    },
};
