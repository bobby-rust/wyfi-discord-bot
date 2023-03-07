import {
    createAudioPlayer,
    joinVoiceChannel,
    createAudioResource,
    StreamType,
    AudioResource,
    generateDependencyReport,
    VoiceConnectionStatus,
    AudioPlayerStatus,
    AudioPlayer,
    entersState,
} from "@discordjs/voice";
import { OpusEncoder } from "@discordjs/opus";
// const lame = require("lame");
import {
    Guild,
    SlashCommandBuilder,
    SlashCommandStringOption,
} from "discord.js";
import ytdl from "ytdl-core";
import fs from "fs";
const { createReadStream } = require("node:fs");
import { join } from "node:path";
const pcmConvert = require("pcm-convert");
// Wrap ytdl in a Promise
function downloadAudio(ytUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const stream = ytdl(ytUrl, {
            filter: "audioonly",
        })
            .on("error", (err: any) => {
                reject(err);
            })
            .on("end", () => {
                resolve("audio.mp3");
            });
        stream.pipe(fs.createWriteStream("audio.mp3"));
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays audio from YouTube URL")
        .addStringOption(option =>
            option
                .setName("url")
                .setDescription("The YouTube URL of the video to play")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("volume")
                .setDescription(
                    "Volume to play the audio at. Must be between 0 and 0.5 inclusive."
                )
                .setRequired(false)
        ),
    async execute(interaction: any) {
        const guild: Guild = interaction.guild;
        let channel = interaction.channel;
        // const opusEncoder = new OpusEncoder(48000, 2);
        const voiceChannels = guild.channels.cache;
        const permissions = channel.permissionsFor(interaction.client.user);
        // console.log(interaction.client.user);
        const ytUrl = interaction.options.get("url").value;
        console.log(
            `interaction argument: ${interaction.options.get("url").value}`
        );
        if (
            !ytUrl.match(
                /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
            )
        ) {
            interaction.reply({
                content: "URL endpoint must be YouTube",
                ephemeral: true,
            });
            return;
        }
        if (!permissions.has("CONNECT")) {
            await interaction.reply("I cannot connect to this channel");
        }
        if (!permissions.has("SPEAK")) {
            await interaction.reply("I cannot speak in this channel.");
        }
        voiceChannels.forEach(c => {
            // console.log(c);
            if (c.type === 2) {
                // console.log(c);
                if (c.name === "General") {
                    channel = c;
                    // console.log("found channel named general.");
                    // console.log(`channel id found: ${channel}`);
                    // console.log(`channel in loop: ${channel}`);
                    return;
                }
            }
        });

        // ytdl(ytUrl, {
        //     filter: "audioonly",
        // }).pipe(fs.createWriteStream("audio.mp3"));

        const resourcePath = await downloadAudio(ytUrl);
        console.log(`resourcePath: ${resourcePath}`);

        const resource: AudioResource = createAudioResource(resourcePath, {
            inlineVolume: true,
        });
        // resource.playbackDuration = 180000;
        // Create the encoder.
        // Specify 48kHz sampling rate and 2 channel size.
        // const encoder = new OpusEncoder(48000, 2);

        // // Encode and decode.
        // const encoded = encoder.encode(resource);
        // const decoded = encoder.decode(encoded);
        if (interaction.options.get("volume")) {
            let volumeArg = interaction.options.get("volume").value;
            if (volumeArg.length > 1 && !volumeArg.includes(".")) {
                interaction.reply({
                    content: "Volume argument must be a number.",
                    ephemeral: true,
                });
                return;
            }
            try {
                volumeArg = parseFloat(volumeArg);
                if (Number.isNaN(volumeArg)) {
                    throw new Error("Volume argument is NaN!");
                }
                console.log(volumeArg);
                if (volumeArg < 0 || volumeArg > 0.5) {
                    interaction.reply({
                        content:
                            "Volume argument must be between 0 and 0.5 inclusive.",
                        ephemeral: true,
                    });
                    return;
                } else {
                    resource.volume?.setVolume(volumeArg);
                }
            } catch (err) {
                console.log(err);
                interaction.reply({
                    content: `An error has occurred: ${err}`,
                    ephemeral: true,
                });
                return;
            }
        } else {
            const volumeArg = 0.05;
            resource.volume?.setVolume(volumeArg);
            console.log(volumeArg);
        }

        // const { metadata } = resource;

        // console.log(`metadata:`);
        // console.dir(metadata);
        // console.log(`resource: ${resource}`);
        // console.log(
        //     channel.id,
        //     channel.guild.id,
        //     channel.guild.voiceAdapterCreator
        // );
        console.log(`channel.id: ${channel.id}`);
        console.log(`channel.guild.id: ${channel.guild.id}`);
        let connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        // console.log(`connection: ${connection}`);

        const player = createAudioPlayer();
        // console.log(`player: ${player}`);

        console.log("playing resource");
        player.play(resource);
        // console.log(resource);
        const subscription = connection.subscribe(player);
        // console.log(`connection: ${connection}`);
        // console.dir(connection);

        player.on("error", (error: any) => console.error(error));

        connection.on(
            "stateChange",
            (oldState: { status: any }, newState: { status: any }) => {
                if (
                    oldState.status === "connecting" &&
                    newState.status === "connecting"
                ) {
                    connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                    });
                }
                console.log(
                    `Connection transitioned from ${oldState.status} to ${newState.status}`
                );
            }
        );

        connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
            player.unpause();
            console.log("Connection is in the Ready state!");
        });

        // connection.on(VoiceConnectionStatus.Signalling, () => {
        //     console.log(
        //         "connection in signalling status"
        //     );
        //     // connection = joinVoiceChannel({
        //     //     channelId: channel.id,
        //     //     guildId: channel.guild.id,
        //     //     adapterCreator: channel.guild.voiceAdapterCreator,
        //     // });
        //     // connection.subscribe(player);
        // });
        connection.on(
            VoiceConnectionStatus.Disconnected,
            async (oldState, newState) => {
                try {
                    await Promise.race([
                        entersState(
                            connection,
                            VoiceConnectionStatus.Signalling,
                            5_000
                        ),
                        entersState(
                            connection,
                            VoiceConnectionStatus.Connecting,
                            5_000
                        ),
                    ]);
                    // Seems to be reconnecting to a new channel - ignore disconnect
                } catch (error) {
                    // Seems to be a real disconnect which SHOULDN'T be recovered from
                    connection.destroy();
                }
            }
        );
        player.on(AudioPlayerStatus.Idle, (oldState, newState) => {
            console.log("Audio player finished.");
            subscription?.unsubscribe();
            connection.destroy();
        });

        player.on("stateChange", (oldState, newState) => {
            console.dir(`player changed from ${oldState} to ${newState}`);
        });

        player.on(AudioPlayerStatus.Playing, (oldState, newState) => {
            console.log("Audio player is in the Playing state!");
        });
        // player.on("stateChange", (oldState: { status: any; }, newState: { status: any; }) => {
        //     console.log(
        //         `Audio player transitioned from ${oldState.status} to ${newState.status}`
        //     );
        // });
        // v6
        // v5

        await interaction.reply({ content: `Playing audio`, ephemeral: true });
    },
};
