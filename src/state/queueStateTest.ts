// import { updateQueueState, QueueAction, queue } from "./queueStateHandler";
import { queue } from "./queueState";
import Song from "../types/song";

const song: Song = {
    id: "1",
    duration: 60,
    title: "cat video",
    thumbnail: "cute-cat.png",
    requester: null,
    url: "youtube.com/watch?v=cat",
};

console.log(queue.getItems());

// const update = {
//     song: song,
//     action: QueueAction.enqueue,
// };

// updateQueueState(update);

queue.enqueue(song);

console.log(queue.getItems());
