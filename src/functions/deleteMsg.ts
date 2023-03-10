import { MessageManager } from "discord.js";

export default async function deleteMsg(
    msgId: string,
    msgManager: MessageManager
) {
    const messages = await msgManager.fetch({
        limit: 10,
        cache: false,
    });

    for (const msg of messages.values()) {
        if (msg.id === msgId) {
            msg.delete();
        }
    }
}
