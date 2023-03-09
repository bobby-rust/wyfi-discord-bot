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
    Events,
    Message,
    ButtonComponent,
    TextChannel,
    MessageManager,
    EmbedBuilder,
} from "discord.js";

import ytdl, { videoInfo } from "ytdl-core";
import fs from "fs";
import { getVideoDuration } from "../functions/getVideoDuration";
import { getSearchResult } from "../functions/getSearchResult";

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
                .setName("search")
                .setDescription(
                    "The query that will be used to search YouTube. The first result will be played."
                )
                .setRequired(false)
        )
        .addStringOption((option: SlashCommandStringOption) =>
            option
                .setName("url")
                .setDescription("The YouTube URL of the video to play")
                .setRequired(false)
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
        const { client } = require("../index");
        const guild: Guild | null = interaction.guild;
        let textChannel: TextChannel = interaction.channel;
        const msgManager: MessageManager = textChannel.messages;
        const voiceChannels = guild?.channels.cache;
        const callerId = interaction.user.id;

        // Get caller's voice channel
        let voiceChannel: VoiceChannel | null = null;
        voiceChannels?.forEach((c) => {
            if (c.type === 2) {
                // 2 = voice
                c.members.forEach((member) => {
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

        // Get arguments
        const queryArg = interaction.options.get("search");
        const urlArg = interaction.options.get("url");
        let searchQuery: string;
        let ytUrl: string;
        let duration: number;
        let ytVid: { url: string; duration: number };
        if (queryArg) {
            // const queryArr: string[] = queryArg.value.split(" ");
            // if (queryArr.length > 1) {
            //     searchQuery = queryArr.join("+");
            // }
            searchQuery = queryArg.value;
            const vidTmp = await getSearchResult(searchQuery);
            console.log(vidTmp);
            let videoDuration: number;
            try {
                videoDuration = vidTmp.duration;
            } catch (err) {
                interaction.editReply({
                    content: `Could not find a video within the 10 minute time limit`,
                    ephemeral: true,
                });
                return;
            }
            ytUrl = "https://www.youtube.com/watch?v=" + vidTmp.id;
            // Set yt video obj
            ytVid = {
                url: ytUrl,
                duration: videoDuration,
            };
        } else if (urlArg) {
            ytUrl = interaction.options.get("url").value;
            console.log(`ytUrl: ${ytUrl}`);
            // Ensure URL endpoint is YouTube
            if (
                !ytUrl.match(
                    /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
                )
            ) {
                interaction.editReply({
                    content: "URL endpoint must be a YouTube video",
                    ephemeral: true,
                });
                return;
            } else {
                // Ensure video length is within limit
                const videoDuration = await getVideoDuration(ytUrl);
                console.log(`videoDuration: ${videoDuration}`);
                if (videoDuration > 600) {
                    // > 10 minutes limit, arbitrarily chosen; can adjust based on user feedback
                    console.log("invalid length");
                    await interaction.editReply({
                        content: "Video length exceeds the 10 minute limit",
                        ephemeral: true,
                    });
                    return;
                }
                // Set yt video obj
                ytVid = {
                    url: ytUrl,
                    duration: videoDuration,
                };
            }
            console.log(
                `interaction argument: ${interaction.options.get("url").value}`
            );
        } else {
            interaction.editReply({
                content: "You must provide either a URL or a search query",
                ephemeral: true,
            });
            return;
        }

        // Get bot's permssions for the caller's voice channel
        const botPermissions: any = voiceChannel.permissionsFor(
            interaction.client.user
        );

        // Notify user of missing permissions and return
        if (!botPermissions.has("CONNECT")) {
            await interaction.editReply({
                content: "I cannot connect to this channel",
                ephemeral: true,
            });
            return;
        }
        if (!botPermissions.has("SPEAK")) {
            await interaction.editReply({
                content: "I cannot speak in this channel.",
                ephemeral: true,
            });
            return;
        }

        // Get resource
        const resourcePath = await downloadAudio(ytUrl);

        // Get resource information
        const songInfo: videoInfo = await ytdl.getInfo(ytUrl);
        // Thumbnail images - currently using size medium, but others are available
        // const thumbnail_md = songInfo.videoDetails.thumbnails[2].url;
        // const thumbnail_xs = songInfo.videoDetails.thumbnails[0].url;
        // const thumbnail_sm = songInfo.videoDetails.thumbnails[1].url;
        const thumbnail_lg = songInfo.videoDetails.thumbnails[3].url;
        const songTitle = songInfo.videoDetails.title;
        const song = {
            title: songTitle,
            url: ytVid.url,
            duration: ytVid.duration,
            requester: interaction.user,
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
            const volumeArg = 0.05; // No volume argument, default to 0.05
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

        // Connection debug messages
        // connection.on("debug", (m) => {
        //     console.log("Voice Debug:", m);
        // });

        // Create and subscribe to audio player
        const player: AudioPlayer = createAudioPlayer();
        const subscription = connection.subscribe(player); // subscribes the player to the connection to play the audio in the current connection

        // Handle connection state changes
        connection.on("error", (error) => {
            console.error(`VoiceConnection error: ${error}`);
        });

        connection.on(
            "stateChange",
            async (oldState: { status: any }, newState: { status: any }) => {
                // Fix for pausing after 60 seconds - see https://github.com/discordjs/discord.js/issues/9185
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

                // Handle stuck on connecting
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
            console.log("Connection is in the Ready state, playing audio!");
        });

        connection.on(
            VoiceConnectionStatus.Disconnected,
            async (oldState, newState) => {
                // const message = oldState.channel.guild.channels.cache
                //     .get(oldState.channel.parentId)
                //     .messages.cache.get(messageId);
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

        // Handle player state changes
        player.on("error", (error: any) => console.error(error));

        player.on(AudioPlayerStatus.Idle, async (oldState, newState: any) => {
            console.log("Audio player finished.");
            console.log(`buttons: ${buttons}`);
            const messages = await msgManager.fetch({
                limit: 3,
                cache: false,
                around: buttons[0],
            });
            const msg = messages.get(buttons[0]);
            msg.edit({ components: [] });
            // console.log(messages);
            // console.dir(messages);
            subscription?.unsubscribe();
            connection.destroy();
            buttons.pop();
        });

        player.on("stateChange", (oldState, newState) => {
            console.dir(`player changed from ${oldState} to ${newState}`);
        });

        player.on(AudioPlayerStatus.Playing, (oldState, newState) => {
            console.log("Audio player is in the Playing state!");
        });

        // Create UI
        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle(`Now playing: ${song.title}`)
            .setURL(`${song.url}`)
            .setAuthor({
                name: "DJ WYFI Bot 🤖",
                iconURL:
                    "https://www.the-sun.com/wp-content/uploads/sites/6/2022/03/NINTCHDBPICT000468152103-1.jpg?w=620",
                // url: "https://discord.js.org",
            })
            .setDescription(`Requested by: ${song.requester.toString()}`)
            .setImage(thumbnail_lg)
            // .setThumbnail(thumbnail_md)
            .addFields({
                name: "Duration: ",
                value: `${Math.floor(song.duration / 60)}m${
                    song.duration % 60
                }s`,
                inline: true,
            })
            //     { name: "\u200B", value: "\u200B" },
            //     {
            //         name: "Inline field title",
            //         value: "Some value here",
            //         inline: true,
            //     },
            //     {
            //         name: "Inline field title",
            //         value: "Some value here",
            //         inline: true,
            //     }
            // )
            // .addFields({
            //     name: "Inline field title",
            //     value: "Some value here",
            //     inline: true,
            // })
            // .setImage("https://i.imgur.com/AfFp7pu.png")
            .setTimestamp(new Date());
        // .setFooter({
        //     text: "Some footer text here",
        //     iconURL: "https://i.imgur.com/AfFp7pu.png",
        // });

        const button = new ButtonBuilder()
            .setCustomId("stop_button")
            .setLabel("Stop")
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        const buttons = [];

        // Create collector
        const filter = (interaction) => interaction.customId === "stop_button";
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: song.duration * 1000,
        });

        // Handle stop button interaction
        collector.on("collect", async (interaction) => {
            if (interaction.customId === "stop_button") {
                console.log(button);
                button.setDisabled(true);
                const connection = getVoiceConnection(interaction.guild.id);
                connection.destroy();
                await interaction.update({
                    components: [],
                    content: `Stopped playing: **${song.title}**`,
                });
                collector.stop();
            }
        });

        // Interaction reply
        const replyOptions = {
            // content: `${interaction.user.toString()} is now playing: **${
            //     song.title
            // }** - ${Math.floor(song.duration / 60)}m${song.duration % 60}s
            // ${thumbnail_md ? `[](${thumbnail_md})` : ""}`,
            //${thumbnail_xs ? `[](${thumbnail_xs})` : ""}
            //${thumbnail_sm ? `[](${thumbnail_sm})` : ""}
            // ${thumbnail_lg ? `[](${thumbnail_lg})` : ""}`,
            components: [row],
            embeds: [embed],
        };
        const songReply = await interaction.editReply(replyOptions);
        buttons.push(songReply.id);
    },
};
