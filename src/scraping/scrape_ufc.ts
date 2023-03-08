const axios = require("axios");
const cheerio = require("cheerio");

const url = "https://www.ufc.com/events";

type EventInfo = {
    headline: { headline: string; url: string };
    date: { date: string; time: string };
    imgUrl: string;
};

export const scrape_ufc = async (): Promise<EventInfo> => {
    const eventInfo = axios
        .get(url, { responseType: "document" })
        .then(async function (response: any) {
            console.log("received response");
            const html = response.data;
            const $ = cheerio.load(html);

            // Get event headline and event number
            const $fightHeadline = $(
                ".l-listing__item article .c-card-event--result__info a"
            );
            const $eventNumber = $(`.c-card-event--result__logo`);
            console.log("calling getHeadline");

            const eventHeadline = getHeadline(
                $fightHeadline.html(),
                $eventNumber.html()
            );

            console.log(`eventHeadline: ${eventHeadline}`);

            // Get event image url
            const imgUrl = await getEventImg(eventHeadline.url);

            // Get date
            const $fightDate = $(".c-card-event--result__info");
            const date = getFightDate($fightDate.html(), false);

            return {
                headline: eventHeadline,
                date: date,
                imgUrl: imgUrl,
            };
        });

    return eventInfo;
};

/**
 * @param html the html string containing the data
 * @param wantPrelims whether to schedule for prelims or main card
 * @returns { Object } date and time in required format
 */
const getFightDate = (
    html: string,
    wantPrelims: boolean
): { date: string; time: string } => {
    const searchQuery = wantPrelims
        ? "data-prelims-card-timestamp="
        : "data-main-card-timestamp=";
    const timestampLoc = html.search(searchQuery) + searchQuery.length + 1;

    let unix_timestamp = "";
    for (let i = timestampLoc; html[i] !== '"'; i++) {
        unix_timestamp += html[i];
    }

    // Create a new JavaScript Date object based on the timestamp
    // multiplied by 1000 so that the argument is in milliseconds, not seconds.
    var dateObj = new Date(parseInt(unix_timestamp) * 1000);
    // Hours part from the timestamp
    var hours = dateObj.getHours();
    // Minutes part from the timestamp
    var minutes = "0" + dateObj.getMinutes();
    // Seconds part from the timestamp

    var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
    d.setUTCSeconds(parseInt(unix_timestamp));
    const dateString: string = d.toJSON();
    console.log(`dateString: ${dateString}`);
    const localDate = d.toLocaleDateString();
    // const localTime = d.toLocaleTimeString();
    console.log(localDate);
    // console.log(localTime);
    const dateArr = localDate.split("/");
    console.log(dateArr);
    const year = dateArr[2].slice(0, 4);
    const month =
        dateArr[0].length === 1
            ? "0" + dateArr[0].split("").slice(0, 1)
            : dateArr[0].slice(0, 2);
    const day =
        dateArr[1].length === 1
            ? "0" + dateArr[1].split("").slice(0, 1)
            : dateArr[1].slice(0, 2);

    const eventDate = year + "-" + month + "-" + day;
    console.log(eventDate);
    // Will display time in 10:30 24h format
    const formattedTime = hours + ":" + minutes.substring(-2);

    return {
        time: formattedTime,
        date: eventDate,
    };
};

/**
 * @param headline the html string containing the headline
 * @param eventNumber the html string containing the event number
 * @returns { Object } headline and event url
 */
const getHeadline = (
    headline: string,
    eventNumber: string
): { headline: string; url: string } => {
    console.log("inside getHeadline");
    const searchQuery = "ufc-";
    const numLoc = eventNumber.search(searchQuery);
    let numStr = "";

    for (let i = numLoc + searchQuery.length; eventNumber[i] !== '"'; i++) {
        numStr += eventNumber[i];
    }

    let fightNight: boolean = false;
    if (numStr.includes("fight-night")) {
        fightNight = true;
    }

    const eventTitle: string = fightNight
        ? getFightNightTitle(numStr)
        : eventNumber;

    console.log(`eventTitle: ${eventTitle}`);

    console.log(`numStr: ${numStr}`);

    const eventHeadline = fightNight
        ? "UFC " + eventTitle + ": " + headline
        : "UFC " + numStr + ": " + headline;
    const eventUrl = "https://www.ufc.com/event/ufc-" + numStr;

    return {
        headline: eventHeadline,
        url: eventUrl,
    };
};

/**
 *
 * @param url the url containing the img to scrape send the get request
 * @returns { string } the image url
 */
const getEventImg = (url: string): Promise<string> => {
    console.log(`Executing getEventImg. url: ${url}`);
    const imgUrl = axios
        .get(url, { responseType: "document" })
        .then(async function (response: any) {
            const html = response.data;
            const $ = cheerio.load(html);

            let imgUrl: string = "";

            const $img = $(".layout__region picture");

            const searchQuery = "<source srcset=";
            const imgLoc = $img.html().search(searchQuery);

            let i = imgLoc + searchQuery.length + 1;
            while ($img.html()[i] !== " ") {
                imgUrl += $img.html()[i];
                i++;
            }

            const sizeStr = "background_image_xl";
            const wantedSize = "background_image_md";

            imgUrl = imgUrl.replace(sizeStr, wantedSize);
            return imgUrl;
        });
    return imgUrl;
};

/**
 * @param title the title extracted from html attribute
 * @return { string } the formatted title
 */
const getFightNightTitle = (htmlTitle: string): string => {
    const tmp: string[] = htmlTitle.split("-");
    const tmp2: string[] = [];
    tmp.forEach((element: string) => {
        element = element.charAt(0).toUpperCase() + element.slice(1);
        tmp2.push(element);
    });
    const eventTitle = tmp2.join(" ");

    console.log(`eventTitle in getFightNightTitle: ${eventTitle}`);
    return eventTitle;
};
