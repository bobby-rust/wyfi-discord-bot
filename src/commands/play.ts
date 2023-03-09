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
    SlashCommandBuilder,
    SlashCommandStringOption,
    VoiceChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    MessageManager,
    EmbedBuilder,
    Embed,
} from "discord.js";

import { downloadAudio } from "../functions/downloadAudio";
import Song from "../types/song";
import {
    SongRequest,
    songRequestHandler,
} from "../functions/songRequestHandler";
import { queue } from "../state/queueState";
import createEmbed from "../functions/createEmbed";

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
        if (!queue.isEmpty()) {
            interaction.editReply({
                content:
                    "The bot is already playing a song. If you'd like to add a song to the queue, use /addsong",
                ephemeral: true,
            });
            return;
        }
        // Get information about caller
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

        // I will use the queue to check if the bot is available instead of this
        // If the bot already has a voice connection, it is not available
        // const voiceConnection: VoiceConnection = getVoiceConnection(guild.id);
        // if (voiceConnection) {
        //     await interaction.editReply({
        //         content:
        //             "The bot is currently not available for a song request",
        //         ephemeral: true,
        //     });
        //     return;
        // }

        console.log(`interaction.user: ${interaction.user}`);
        console.log(`typeof interaction.user ${typeof interaction.user}`);

        // Get arguments
        const queryArg = interaction.options.get("search");
        const urlArg = interaction.options.get("url");

        let song: Song = {
            id: null,
            duration: null,
            title: null,
            thumbnail: null,
            requester: interaction.user.username,
            url: null,
        };
        const request: SongRequest = {
            query: null,
            url: null,
        };

        if (queryArg) {
            request.query = queryArg.value;
            song = await songRequestHandler(request);
        } else if (urlArg) {
            request.url = urlArg.value;
            song = await songRequestHandler(request);
        } else {
            interaction.editReply({
                content: "You must provide either a URL or a search query",
                ephemeral: true,
            });
            return;
        }

        console.log(song);
        queue.enqueue(song);
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
        let resourcePath = await downloadAudio(song.url);

        // Create audio resource
        let resource: AudioResource = createAudioResource(resourcePath, {
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
                    queue.dequeue();
                }
            }
        );

        // Handle player state changes
        player.on("error", (error: any) => console.error(error));

        player.on(AudioPlayerStatus.Idle, async (oldState, newState: any) => {
            console.log("Song finished.");
            console.log(`buttons: ${buttons}`);
            const messages = await msgManager.fetch({
                limit: 10,
                cache: false,
                around: buttons[0],
            });
            const msg = messages.get(buttons[0]);
            msg.edit({ components: [] });
            // console.log(messages);
            // console.dir(messages);
            queue.dequeue();
            buttons.pop();
            if (queue.isEmpty()) {
                subscription?.unsubscribe();
                connection.destroy();
            } else {
                const song: Song = queue.getItems()[0];
                console.log(`song in play: ${song}`);
                resourcePath = await downloadAudio(queue.getItems()[0].url);
                resource = createAudioResource(resourcePath, {
                    inlineVolume: true,
                });
                player.play(resource);
                const embed = createEmbed(song);
                interaction.editReply({ embeds: [embed] });
            }
        });

        player.on("stateChange", (oldState, newState) => {
            console.dir(`player changed from ${oldState} to ${newState}`);
        });

        player.on(AudioPlayerStatus.Playing, (oldState, newState) => {
            console.log("Audio player is in the Playing state!");
        });

        const embed: EmbedBuilder = createEmbed(song);
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
                queue.dequeue();
                await interaction.update({
                    components: [],
                    content: `Stopped playing: **${song.title}**`,
                });
                collector.stop();
            }
        });

        // Interaction reply
        const replyOptions = {
            components: [row],
            embeds: [embed],
        };
        const songReply = await interaction.editReply(replyOptions);
        buttons.push(songReply.id);
    },
};
