import { SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { queue } from "../state/queueState";
import Song from "../types/song";
import {
    SongRequest,
    songRequestHandler,
} from "../functions/songRequestHandler";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addsong")
        .setDescription("Adds a song to the queue")
        .addStringOption((option: SlashCommandStringOption) =>
            option
                .setName("url")
                .setDescription("The URL of the song to add")
                .setRequired(true)
        ),
    async execute(interaction: any) {
        console.log(queue.getItems());
        const url = interaction.options.get("url").value;

        const request: SongRequest = {
            query: null,
            url: url,
        };
        const song: Song = await songRequestHandler(request);
        song.requester = interaction.user.username;
        console.log(`song in addSong: ${song}`);
        queue.enqueue(song);

        console.log(queue.getItems());

        interaction.reply({ content: "Song added to queue", ephemeral: true });
    },
};
