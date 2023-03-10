interface IQueue<T> {
    enqueue(item: T): void;
    dequeue(): T | undefined;
    size(): number;
    isEmpty(): boolean;
    getItems(): T[];
}

class Queue<T> implements IQueue<T> {
    private items: T[] = [];

    // Singleton class
    private static instance: Queue<any>;
    public static getInstance<T>(): Queue<T> {
        if (!Queue.instance) {
            Queue.instance = new Queue<T>();
        }
        return Queue.instance as Queue<T>;
    }

    private constructor() {}

    public getItems() {
        return this.items;
    }

    public front() {
        return this.items[0];
    }

    public enqueue(item: T) {
        this.items.push(item);
    }

    public dequeue(): T {
        return this.items.shift();
    }

    public size(): number {
        return this.items.length;
    }

    public isEmpty(): boolean {
        return this.items.length === 0;
    }
}

export default Queue;
