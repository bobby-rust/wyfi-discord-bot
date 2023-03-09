import { User } from "discord.js";

type Song = {
    id: string | null;
    duration: number | null;
    title: string | null;
    thumbnail: string | null;
    requester: User;
    url: string | null;
    error?: string;
};

export default Song;
