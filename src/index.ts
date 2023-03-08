const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
const { token } = require("../config.json");
import { getVoiceConnection, getVoiceConnections } from "@discordjs/voice";
import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

module.exports = {
    client,
};
client.once(Events.ClientReady, (t_client: any) => {
    console.log(`Ready! Logged in as ${t_client.user.tag}`);
});

const watcher = chokidar.watch("./src", { ignoreInitial: true });

watcher.on("all", (event, path) => {
    console.log(`File ${path} has been changed`);
    //
    const voiceConnections = getVoiceConnections();
    console.log(voiceConnections);
    voiceConnections.forEach((connection: { disconnect: () => void }) => {
        console.log("voice connection found, disconnecting");
        connection.disconnect();
        console.log();
    });

    // Do any other cleanup work here
});

process.on("SIGINT", () => {
    console.log("process sigint");
    const voiceConnections = getVoiceConnections();
    voiceConnections.forEach((connection: { disconnect: () => void }) => {
        console.log("voice connection found");
        connection.disconnect();
    });
    process.exit();
});

process.on("restart", () => {
    console.log("process restart");
    const voiceConnections = getVoiceConnections();
    voiceConnections.forEach((connection: { disconnect: () => void }) => {
        console.log("voice connection found");
        connection.disconnect();
    });
    process.exit();
});

client.login(token);

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file: string) => file.endsWith(".ts"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(
            `[WARNING] The command at ${filePath} is missing a required "data" or "execute" field.`
        );
    }
}

client.on(Events.MessageCreate, async (message: any) => {
    if (message.content.toLowerCase() === "!stop") {
        console.log("message is !stop");
        // cleanup
        const connection = getVoiceConnection(message.guild.id);
        connection?.destroy();
        message.delete();
    }
});

client.on(Events.InteractionCreate, async (interaction: any) => {
    const command = interaction.client.commands.get(interaction.commandName);

    if (interaction.isButton()) return;
    // if (interaction.isButton()) {
    //     console.log(interaction);
    //     // cleanup
    //     const connection = getVoiceConnection(interaction.guild.id);
    //     connection?.destroy();
    //     await interaction.reply({ content: "Song stopped", ephemeral: true });
    //     return;
    // }

    // if (command.data.name == "ce") {
    //     console.log("Create event called");
    // }

    if (command.data.name === "play" || command.data.name === "ce") {
        // long running commands, defer reply
        await interaction.deferReply();
    }

    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        }
    }
});
