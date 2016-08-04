const debug = false;
const destination = 'open.spotify.com';

function syncGetJson(url) {
  const request = new XMLHttpRequest();
  request.open('GET', url, false);
  request.send(null);
  return JSON.parse(request.responseText);
}

function logger(...args) {
  if (debug) {
    console.log(...args);
  }
};

function spotifyToItunes(spotifyUrl)  {
  const spotifyTypesToItunesEntity = {
    "artist": "musicArtist",
    "track" : "song",
    "album" : "album"
  }

  const spotifyTypesToItunesUrlKey = {
    "artist": "artistLinkUrl",
    "track" : "trackViewUrl",
    "album" : "collectionViewUrl"
  }

  const pathElements = spotifyUrl.pathname.split("/").slice(1);
  const reqResourceType = pathElements[0];
  if (!Object.keys(spotifyTypesToItunesEntity).includes(reqResourceType)) {
    logger("Unrecognized Type:", reqResourceType);
    return;
  }
  const reqResourceId = pathElements[1];

  const { name } = syncGetJson(`https://api.spotify.com/v1/${reqResourceType}s/${reqResourceId}`);
  logger("Name: ", name);

  const { results, resultCount } = syncGetJson(
    `https://itunes.apple.com/search?term=${name}&entity=${spotifyTypesToItunesEntity[reqResourceType]}`
  );

  if(resultCount === 0) {
    logger('No Results on iTunes search for', name);
    return
  }

  const destUrl = results[0][spotifyTypesToItunesUrlKey[reqResourceType]];

  logger('Redirecting to:', destUrl);
  return destUrl;
}

function itunesToSpotify (itunesUrl) {
  const itunesEntitiesToItunesNameKeys = {
    "album" : "collectionName",
    "artist": "artistName",
    "track" : "trackName",
  }
  const pathElements = itunesUrl.pathname.split("/").slice(1);
  let reqResourceType = pathElements[1];
  let reqResourceId = pathElements[3] && pathElements[3].slice(2);  

  if(itunesUrl.searchParams.get("i")) {
    reqResourceType = "track";
    reqResourceId = itunesUrl.searchParams.get("i");
  }

  if(!Object.keys(itunesEntitiesToItunesNameKeys).includes(reqResourceType)){
    logger("Unrecognized Type:", reqResourceType);
    return
  }

  const reqResource = syncGetJson(
    `https://itunes.apple.com/lookup?id=${reqResourceId}`
  ).results[0];
  const name = reqResource[itunesEntitiesToItunesNameKeys[reqResourceType]];
  logger("Name:", name);
  const destSearchResult = syncGetJson(
    `https://api.spotify.com/v1/search?q=${name}&type=${reqResourceType}`
  );
  if(destSearchResult[`${reqResourceType}s`].total === 0){
    logger('No Results on Spotify search for', name);
    return;
  }
  const destUrl = destSearchResult[`${reqResourceType}s`].items[0]["external_urls"].spotify;

  logger('Redirecting to:', destUrl);
  return destUrl
}

function translator(destination) {
  switch (destination){
    case 'open.spotify.com':
      return itunesToSpotify;
    default:
      return spotifyToItunes;
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  function(info) {
    logger("DEBUG: intercept = ", info.url);
    const reqUrl = new URL(info.url);

    if(reqUrl.host === destination) {
      return;
    }

    destUrl = translator(destination)(reqUrl);
    return { redirectUrl: destUrl };
  },
  {
    urls: [
      "https://open.spotify.com/*",
      "https://itunes.apple.com/*"
    ]
  },
  ["blocking"]
);