import {
    createAudioPlayer,
    joinVoiceChannel,
    createAudioResource,
    AudioResource,
    generateDependencyReport,
    VoiceConnectionStatus,
    AudioPlayerStatus,
    AudioPlayer,
    entersState,
    VoiceConnection,
    getVoiceConnection,
} from "@discordjs/voice";

import {
    Guild,
    GuildTextBasedChannel,
    SlashCommandBuilder,
    SlashCommandStringOption,
    VoiceChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponent,
} from "discord.js";

import ytdl, { videoInfo } from "ytdl-core";
import fs from "fs";
import { getVideoDuration } from "../functions/getVideoDuration";
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
        .addStringOption((option: SlashCommandStringOption) =>
            option
                .setName("url")
                .setDescription("The YouTube URL of the video to play")
                .setRequired(true)
        )
        .addStringOption(
            (option: SlashCommandStringOption) =>
                option
                    .setName("volume")
                    .setDescription(
                        "The volume to play the audio; must be in the range 0 to 0.5 inclusive."
                    )
                    .setRequired(false) // Default to 0.05
        ),
    async execute(interaction: any) {
        // Get information about caller
        const guild: Guild | null = interaction.guild;
        let textChannel: GuildTextBasedChannel = interaction.channel;
        const voiceChannels = guild?.channels.cache;
        const callerId = interaction.user.id;

        // If the bot already has a voice connection, it is not available
        const voiceConnection: VoiceConnection = getVoiceConnection(guild.id);
        if (voiceConnection) {
            await interaction.editReply({
                content:
                    "The bot is currently not available for a song request",
                ephemeral: true,
            });
            return;
        }

        // Get url argument
        const ytUrl = interaction.options.get("url").value;
        console.log(
            `interaction argument: ${interaction.options.get("url").value}`
        );

        // Ensure URL endpoint is YouTube
        if (
            !ytUrl.match(
                /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
            )
        ) {
            interaction.editReply({
                content: "URL endpoint must be YouTube",
                ephemeral: true,
            });
            return;
        }

        const videoDuration = await getVideoDuration(ytUrl);
        console.log(`videoDuration: ${videoDuration}`);
        if (videoDuration > 600) {
            console.log("invalid length");
            await interaction.editReply({
                content: "Video length exceeds the 10 minute limit",
                ephemeral: true,
            });
            return;
        }
        let voiceChannel: VoiceChannel | null = null;
        voiceChannels?.forEach(c => {
            if (c.type === 2) {
                // 2 = voice
                c.members.forEach(member => {
                    // Find caller's channel
                    if (member.id === callerId) {
                        voiceChannel = c;
                        return;
                    }
                });
            }
        });
        // User is not in a voice channel, alert and return
        if (!voiceChannel) {
            await interaction.editReply({
                content: "You are not connected to a voice channel!",
                ephemeral: true,
            });
            return;
        }
        const permissions: any = voiceChannel.permissionsFor(
            interaction.client.user
        );

        // Notify user of missing permissions and return
        if (!permissions.has("CONNECT")) {
            await interaction.editReply({
                content: "I cannot connect to this channel",
                ephemeral: true,
            });
            return;
        }
        if (!permissions.has("SPEAK")) {
            await interaction.editReply({
                content: "I cannot speak in this channel.",
                ephemeral: true,
            });
            return;
        }

        // Get resource
        const resourcePath = await downloadAudio(ytUrl);
        const songInfo: videoInfo = await ytdl.getInfo(ytUrl);
        // console.log(
        //     `songInfo.videoDetails.thumbnail: ${songInfo.videoDetails.thumbnail}`
        // );
        // console.log("songInfo.videoDetails.thumbailS:");
        // console.dir(songInfo.videoDetails.thumbnails);
        // const thumbnail_xs = songInfo.videoDetails.thumbnails[0].url;
        // const thumbnail_sm = songInfo.videoDetails.thumbnails[1].url;
        const thumbnail_md = songInfo.videoDetails.thumbnails[2].url;
        // const thumbnail_lg = songInfo.videoDetails.thumbnails[3].url;
        const songTitle = songInfo.videoDetails.title;
        const song = {
            title: songTitle,
            url: ytUrl,
            duration: videoDuration,
            requester: interaction.author,
            connection: null,
            dispatcher: null,
        };

        // Create audio resource
        const resource: AudioResource = createAudioResource(resourcePath, {
            inlineVolume: true,
        });

        // Handle volume argument
        if (interaction.options.get("volume")) {
            let volumeArg = interaction.options.get("volume").value;
            if (volumeArg.length > 1 && !volumeArg.includes(".")) {
                interaction.editReply({
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
                    interaction.editReply({
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
                interaction.editReply({
                    content: `An error has occurred: ${err}`,
                    ephemeral: true,
                });
                return;
            }
        } else {
            const volumeArg = 0.05;
            resource.volume?.setVolume(volumeArg);
            console.log(`volumeArg: ${volumeArg}`);
        }

        // Join the voice channel
        let connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            // debug: true,
        });

        connection.on("error", error => {
            console.error(`VoiceConnection error: ${error}`);
        });

        // connection.on("debug", (m) => {
        //     console.log("Voice Debug:", m);
        // });

        // Create audio player

        const player: AudioPlayer = createAudioPlayer();

        console.log("subscribing to AudioPlayer");
        const subscription = connection.subscribe(player); // subscribes the player to the connection to play the audio in the current connection

        player.on("error", (error: any) => console.error(error));

        connection.on(
            "stateChange",
            async (oldState: { status: any }, newState: { status: any }) => {
                const oldNetworking = Reflect.get(oldState, "networking");
                const newNetworking = Reflect.get(newState, "networking");

                const networkStateChangeHandler = (
                    oldNetworkState: any,
                    newNetworkState: any
                ) => {
                    const newUdp = Reflect.get(newNetworkState, "udp");
                    clearInterval(newUdp?.keepAliveInterval);
                };

                oldNetworking?.off("stateChange", networkStateChangeHandler);
                newNetworking?.on("stateChange", networkStateChangeHandler);
                console.log(
                    `connection changed from ${oldState.status} to ${newState.status}`
                );
                let isConnecting = false;
                let connectingTimeout: NodeJS.Timeout | null = null;
                if (newState.status === VoiceConnectionStatus.Connecting) {
                    isConnecting = true;
                    connectingTimeout = setTimeout(() => {
                        if (
                            isConnecting &&
                            connection.state.status ===
                                VoiceConnectionStatus.Connecting
                        ) {
                            console.log("Audio player is stuck on connecting");
                            // Take appropriate action, such as disconnecting and reconnecting the bot
                            connection.configureNetworking();
                            // connection.disconnect();
                            // connection.destroy();
                            // connection = joinVoiceChannel({
                            //     channelId: voiceChannel.id,
                            //     guildId: voiceChannel.guild.id,
                            //     adapterCreator:
                            //         voiceChannel.guild.voiceAdapterCreator,
                            //     // debug: true,
                            // });
                        }
                    }, 3000); // 3 seconds
                } else {
                    console.log(`connection status: ${newState.status}`);
                    isConnecting = false;
                    if (connectingTimeout !== null) {
                        clearTimeout(connectingTimeout);
                        connectingTimeout = null;
                    }
                }
            }
        );

        connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
            player.play(resource);
            // connection.subscribe(player);
            // player.unpause();
            console.log("Connection is in the Ready state, playing audio!");
        });

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

        const button = new ButtonBuilder()
            .setCustomId("stop_button")
            .setLabel("Stop")
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        // await interaction.editReply({
        //     content: `${interaction.user.toString()} requested ${ytUrl} :notes: Playing audio!`,
        //     components: [row],
        // });
        const filter = interaction => interaction.customId === "stop_button";

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: videoDuration * 1000,
        });

        collector.on("collect", async interaction => {
            if (interaction.customId === "stop_button") {
                console.log(button);
                button.setDisabled(true);
                const connection = getVoiceConnection(interaction.guild.id);
                connection.destroy();
                collector.stop();
                await interaction.update({
                    components: [],
                    content: `Stopped playing: **${song.title}**`,
                });
            }
        });

        const replyOptions = {
            content: `Now playing: **${song.title}** - ${Math.floor(
                song.duration / 60
            )}m${song.duration % 60}s 
            ${thumbnail_md ? `[](${thumbnail_md})` : ""}`,
            //${thumbnail_xs ? `[](${thumbnail_xs})` : ""}
            //${thumbnail_sm ? `[](${thumbnail_sm})` : ""}
            // ${thumbnail_lg ? `[](${thumbnail_lg})` : ""}`,
            components: [row],
        };
        await interaction.editReply(replyOptions);
    },
};
