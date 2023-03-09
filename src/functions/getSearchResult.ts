const axios = require("axios");
const { YT_API_KEY } = require("../../config.json");
import { getVideoDuration } from "./getVideoDuration";

export async function getSearchResult(
    query: string
): Promise<{ id: string; duration: number }> {
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
        .then((res) => {
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
    let result: { id: string; duration: number };
    console.log(results);
    for (const res of results) {
        duration = await getVideoDuration(res);
        if (duration < 600) {
            console.log("returning an object");
            result = {
                id: res,
                duration: duration,
            };
            break;
        }
    }
    console.log(`result in getSearchResults: ${result}`);
    return result;
}
