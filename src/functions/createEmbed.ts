import { EmbedBuilder } from "@discordjs/builders";
import Song from "../types/song";

export default function createEmbed(song: Song): EmbedBuilder {
    // Create UI
    const embed: EmbedBuilder = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle(`Now playing: ${song.title}`)
        .setURL(`${song.url}`)
        .setAuthor({
            name: "DJ WYFI Bot 🤖",
            iconURL:
                "https://www.the-sun.com/wp-content/uploads/sites/6/2022/03/NINTCHDBPICT000468152103-1.jpg?w=620",
            // url: "https://discord.js.org",
        })
        .setDescription(`Requested by: ${song.requester}`)
        .setImage(song.thumbnail)
        // .setThumbnail(thumbnail_md)
        .addFields({
            name: "Duration: ",
            value: `${Math.floor(song.duration / 60)}m${song.duration % 60}s`,
            inline: true,
        })
        .setTimestamp(new Date());

    return embed;
}
