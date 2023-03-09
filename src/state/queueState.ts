import Queue from "../data-structures/queue";
import Song from "../types/song";

const queue = Queue.getInstance<Song>();

export { queue };
