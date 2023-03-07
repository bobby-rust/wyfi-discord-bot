import ytdl from "ytdl-core";
import fs from "fs";

ytdl("https://www.youtube.com/watch?v=-E-Fei6LJ1g", {
    filter: "audioonly",
}).pipe(fs.createWriteStream("audio.mp3"));
