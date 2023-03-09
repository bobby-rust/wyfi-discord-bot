const axios = require("axios");
const { YT_API_KEY } = require("../../config.json");
import { getVideoDuration } from "./getVideoDuration";
import Song from "../types/song";
import { songRequestHandler } from "./songRequestHandler";

export async function getSearchResults(query: string): Promise<Song> {
    console.log(query);
    const results = await axios
        .get("https://www.googleapis.com/youtube/v3/search", {
            params: {
                key: YT_API_KEY,
                part: "id",
                q: query,
                type: "video",
                maxResults: 10,
            },
        })
        .then(res => {
            // Get the video IDs from the API response
            const videoIds = res.data.items.map(
                (item: { id: { videoId: any } }) => item.id.videoId
            );

            // Do something with the video IDs
            console.log(`Found ${videoIds.length} videos.`);
            return videoIds;
        })
        .catch((err: any) => {
            console.error("The API returned an error:", err);
        });

    let duration: number;
    let result: Song = {
        id: null,
        duration: null,
        title: null,
        thumbnail: null,
        requester: null,
        url: null,
    };
    console.log(results);
    if (results.length === 0) {
        return result;
    }
    for (const res of results) {
        duration = await getVideoDuration(res);
        if (duration < 600) {
            console.log(`duration: ${duration}`);
            console.log("returning an object");
            result = {
                id: res,
                duration: duration,
                title: null, // comes from ytdl info
                thumbnail: null, // comes from ytdl info
                requester: null, // comes from play function
                url: "https://www.youtube.com/watch?v=" + res,
            };
            break;
        }
    }
    console.log(`result in getSearchResults: ${result}`);
    console.dir(result);
    return result;
}
