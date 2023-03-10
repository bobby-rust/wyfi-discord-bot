import Song from "../types/song";
import { getSearchResults } from "./getSearchResults";
import { getVideoDuration } from "./getVideoDuration";
import ytdl, { videoInfo } from "ytdl-core";

export type SongRequest = {
    query: string | null;
    url: string | null;
};

// Takes in search query OR url, returns song object
export async function songRequestHandler(
    songRequest: SongRequest
): Promise<Song> {
    let song: Song = {
        msgId: null,
        vidId: null,
        duration: null,
        title: null,
        thumbnail: null,
        requester: null,
        url: null,
    };

    // Handle search query request
    if (songRequest.query) {
        song = await getSearchResults(songRequest.query);
        if (song.vidId === null) {
            song.error = "Could not find any videos using the search query";
            return song;
        } else if (song.duration === null) {
            song.error = "Could not find a video within the 10 minute limit";
            return song;
        }
    }
    // Handle url request
    else if (songRequest.url) {
        song.url = songRequest.url;
        song.vidId = song.url.split("=")[1];
        if (
            !songRequest.url.match(
                /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
            )
        ) {
            song.error = "URL endpoint must be a YouTube video";
            return song;
        } else {
            const songDuration = await getVideoDuration(song.vidId);
            console.log(`songDuration: ${songDuration}`);
            if (!(songDuration < 600)) {
                song.error = "Video exceed the 10 minute limit";
                return song;
            }
            song.duration = songDuration;
        }
    } else {
        song.error = "You must provide either a URL or a search query";
        return song;
    }

    // Get song details
    console.log("getting song deatils");
    const songInfo: videoInfo = await ytdl.getInfo(song.url);
    const songDetails = songInfo.videoDetails;
    song.title = songDetails.title;
    song.thumbnail = songDetails.thumbnails[3].url;

    return song;
}

/**
 * Some simple tests
 * Test1: valid search query request
 * Test2: valid url request
 * Test3: More than 10 minutes search request
 * Test4: More than 10 minutes url request
 * Test5: No arguments passed
 * Test6: invalid url passed
 */

// Valid query request
const request1: SongRequest = {
    url: null,
    query: "cats",
};

// Valid url request
const request2: SongRequest = {
    url: "https://www.youtube.com/watch?v=gQtKJbptcns",
    query: null,
};

// More than 10 minutes search request
const request3: SongRequest = {
    url: null,
    query: "rain sounds",
};

// More than 10 minutes URL request
const request4: SongRequest = {
    url: "https://www.youtube.com/watch?v=TYo31aYOngo",
    query: null,
};
// No args passed..

const request5: SongRequest = {
    url: null,
    query: null,
};

// invalid URL
const request6: SongRequest = {
    url: "1111ffff3333",
    query: "absccc1324",
};

async function testSongRequestHandler(request: SongRequest) {
    const song = await songRequestHandler(request);
    console.log(song);
}

// Should give valid song obect
// testSongRequestHandler(request6);
