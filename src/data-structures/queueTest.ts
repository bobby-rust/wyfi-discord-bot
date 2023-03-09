import Queue from "./queue";

const queue = Queue.getInstance<string>();
const queue2 = Queue.getInstance<string>();

queue2.enqueue("d");
queue2.enqueue("e");
queue2.enqueue("f");
console.log(queue2.getItems());
console.log(queue.dequeue());

queue.enqueue("a");
console.log(queue.getItems());
queue.enqueue("b");
console.log(queue.getItems());

queue.enqueue("c");
console.log(queue.getItems());

console.log(queue.dequeue());

console.log(queue.getItems());

// Each time the play command is called, it needs to create a song object but defer playing it until AudioPlayer.Idle
// The bot should create a queue object when it goes online, because we don't want to create one every time play is called
// We can use singleton design pattern to ensure that there is only one queue?
