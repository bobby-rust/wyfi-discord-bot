import {
    SlashCommandBuilder,
    Guild,
    GuildScheduledEventCreateOptions,
    GuildScheduledEventPrivacyLevel,
    GuildScheduledEventEntityType,
    GuildVoiceChannelResolvable,
    ChannelType,
    VoiceChannel,
} from "discord.js";

import { scrape_ufc } from "../scraping/scrape_ufc";

import { GuildScheduledEventManager } from "discord.js";
// declare module "discord.js" {
//     interface Guild {
//         scheduleEvent(
//             date: Date,
//             options?: GuildScheduledEventCreateOptions
//         ): Promise<GuildScheduledEvent>;
//     }
// }

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
            // console.log(c);
            if (c.type === 2) {
                console.log(c);
                if (c.name === "General") {
                    channel = c;
                    console.log("found channel named general.");
                    console.log(`channel id found: ${channel}`);
                    // console.log(`channel in loop: ${channel}`);
                    return;
                }
            }
        });

        // console.log(`made it out of loop. channel: ${channel}`);

        if (interaction.options.getString("type").toLowerCase() !== "ufc") {
            await interaction.editReply({
                content:
                    "Create event cancelled. Currently only UFC events are supported.",
                ephemeral: true,
            });
            return;
        }

        console.log("executing scrape()");
        const eventInfo = await scrape_ufc();

        console.log(`channel.id: ${channel.id}`);

        // console.log(eventInfo);
        const eventParams: GuildScheduledEventCreateOptions = {
            name: eventInfo.headline.headline,
            scheduledStartTime: eventInfo.date.date + " " + eventInfo.date.time,
            image: eventInfo.imgUrl,
            description: eventInfo.headline.headline,
            privacyLevel: 2 as GuildScheduledEventPrivacyLevel,
            entityType: 2 as GuildScheduledEventEntityType,
            channel: channel.id,
        };

        const event = await guild.scheduledEvents.create(eventParams);

        console.log(eventInfo);

        await interaction.editReply(`Event created: ${event.name}`);
    },
};
