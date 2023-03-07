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
    VoiceConnection,
    getVoiceConnection,
} from "@discordjs/voice";

import {
    BaseInteraction,
    Channel,
    ChatInputCommandInteraction,
    CommandInteraction,
    DMChannel,
    Guild,
    Interaction,
    PartialDMChannel,
    PermissionResolvable,
    SlashCommandBuilder,
    SlashCommandStringOption,
    TextBasedChannel,
    TextChannel,
} from "discord.js";
import ytdl from "ytdl-core";
import fs from "fs";

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

// function sleep(ms: number) {
//     return new Promise((resolve) => {
//         setTimeout(resolve, ms);
//     });
// }

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
        let channel: any = interaction.channel;
        const voiceChannels = guild?.channels.cache;
        const permissions: any = channel?.permissionsFor(
            interaction.client.user
        );

        const voiceConnection = getVoiceConnection(guild.id);
        if (voiceConnection) {
            await interaction.reply({
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
            interaction.reply({
                content: "URL endpoint must be YouTube",
                ephemeral: true,
            });
            return;
        }

        // Notify user of missing permissions and return
        if (!permissions.has("CONNECT")) {
            await interaction.reply("I cannot connect to this channel");
            return;
        }
        if (!permissions.has("SPEAK")) {
            await interaction.reply("I cannot speak in this channel.");
            return;
        }

        voiceChannels?.forEach((c) => {
            if (c.type === 2) {
                // 2 = voice
                if (c.name === "General") {
                    // Play in General for now, should change this to check for id or something..
                    channel = c;
                    return;
                }
            }
        });

        // Get resource
        const resourcePath = await downloadAudio(ytUrl);

        // Create audio resource
        const resource: AudioResource = createAudioResource(resourcePath, {
            inlineVolume: true,
        });

        // Handle volume argument
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
            console.log(`volumeArg: ${volumeArg}`);
        }

        // Join the voice channel
        let connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            // debug: true,
        });

        connection.on("error", (error) => {
            console.error(`VoiceConnection error: ${error}`);
        });

        // connection.on("debug", (m) => {
        //     console.log("Voice Debug:", m);
        // });

        // Create audio player
        const player = createAudioPlayer();

        // Begin playing resource with AudioPlayer
        // console.log("playing resource");
        // player.play(resource);
        console.log("subscribing to AudioPlayer");
        const subscription = connection.subscribe(player); // subscribes the player to the connection to play the audio in the current connection

        player.on("error", (error: any) => console.error(error));

        // function sleep(ms: number) {
        //     return new Promise((resolve) => setInterval(resolve, ms));
        // }

        // async function wait() {
        //     console.log("Waiting for 3000ms...");
        //     await sleep(3000);
        //     console.log("3000ms have passed.");
        // }

        // wait();
        let numRetries = 0;
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
                            connection.disconnect();
                            connection.rejoin();
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
                // console.log(`numRetries: ${numRetries}`);
                // if (
                //     oldState.status === "ready" &&
                //     newState.status === "connecting"
                // ) {
                //     connection.configureNetworking();
                // } else if (
                //     oldState.status === "connecting" &&
                //     newState.status === "connecting"
                // ) {
                //     numRetries++;
                //     if (numRetries > 4) {
                //         connection.configureNetworking();
                //     }
                // }
                // if (
                //     oldState.status === "connecting" &&
                //     newState.status === "connecting"
                // ) {
                //     console.log(`numRetries: ${numRetries}`);
                //     if (numRetries >= 0 && numRetries <= 2) {
                //         numRetries++;
                //         console.log("sleeping");
                //         await wait();
                //         console.log("wait finished");
                //     } else if (numRetries > 2) {
                //         numRetries++;
                //         connection = joinVoiceChannel({
                //             channelId: channel.id,
                //             guildId: channel.guild.id,
                //             adapterCreator: channel.guild.voiceAdapterCreator,
                //         });
                //     } else {
                //         numRetries++;
                //     }
                // }
                // console.log(
                //     `Connection transitioned from ${oldState.status} to ${newState.status}`
                // );
            }
        );

        connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
            numRetries = 0;
            console.log(`numRetries reset to: ${numRetries}`);
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

        // console.dir(interaction);
        // console.log(interaction);
        await interaction.reply({
            content: `${interaction.user.toString()} requested ${ytUrl} :notes: Playing audio!`,
            ephemeral: false,
        });
    },
};
