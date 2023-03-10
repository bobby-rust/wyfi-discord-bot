import {
    AudioResource,
    createAudioResource,
    VoiceConnection,
} from "@discordjs/voice";
import { MessageManager } from "discord.js";
import { queue } from "../state/queueState";
import Song from "../types/song";
import createEmbed from "./createEmbed";
import { downloadAudio } from "./downloadAudio";

/**
 * When a song finishes:
 * remove song that finished from queue (save reference to removed song)
 *  IF the queue is empty:
 *      remove stop button
 *      edit the ended song's message to say finished
 *      leave voice channel
 * ELSE:
 *  Load next song
 *  delete previous song's message
 *  create message for new song
 *  play the song!
 */

export default async function handleSongFinished(
    msgManager: MessageManager,
    buttons: string[],
    connection?: VoiceConnection
): Promise<AudioResource | null> {
    console.log("in handleSongFinishede");
    // Get previous song
    const prevSong = queue.dequeue();
    console.log(`prevSong: ${prevSong}`);
    // Get messages
    const messages = await msgManager.fetch({
        limit: 10,
        cache: false,
    });
    console.log(prevSong);
    const prevSongMsg = messages.get(prevSong.msgId);
    console.log(prevSongMsg);
    console.log("about to edit prevsongmsg");
    prevSongMsg.edit({ components: [] }); // Delete button from previous song
    console.log("prevsongmsg edited");
    if (queue.isEmpty()) {
        console.log("queue is empty, about to edit prevsongmsg");
        const newEmbed = createEmbed(prevSong, "Finished");
        prevSongMsg.edit({ embeds: [newEmbed] });
        console.log("queue is empty, finished edit prevsongmsg");
        if (connection) {
            connection.destroy();
        }
        return null;
    } else {
        prevSongMsg.delete();
        const nextSong: Song = queue.front();
        const resourcePath = await downloadAudio(nextSong.url);
        const resource: AudioResource = createAudioResource(resourcePath, {
            inlineVolume: true,
        });

        return resource;
    }
}
