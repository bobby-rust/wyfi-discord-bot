const axios = require("axios");
const { YT_API_KEY } = require("../../config.json");

export const getVideoDuration = async (videoId: string): Promise<number> => {
    if (
        videoId.match(
            /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
        )
    ) {
        // Extract the video ID from the URL
        videoId = videoId.split("=")[1];
    }
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${YT_API_KEY}
    `;
    const duration = await axios
        .get(apiUrl)
        .then(
            (response: {
                data: { items: { contentDetails: { duration: any } }[] };
            }) => {
                // Extract the length of the video in ISO 8601 format
                // console.log(response.data.items[0].contentDetails);
                const duration = response.data.items[0].contentDetails.duration;
                console.log(duration);

                // Parse the ISO 8601 duration format
                const durationSeconds = parseDuration(duration);
                return durationSeconds;
            }
        )
        .catch((error: string) => {
            console.log(error);
        });
    return duration;
};

// Function to parse ISO 8601 duration format and return duration in seconds
function parseDuration(duration: string | null) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    console.log(`match: ${match}`);
    if (match) {
        const hours = match[1] ? parseInt(match[1].slice(0, -1)) : 0;
        console.log("past hours");
        const minutes = match[2] ? parseInt(match[2].slice(0, -1)) : 0;
        const seconds = match[3] ? parseInt(match[3].slice(0, -1)) : 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
}
