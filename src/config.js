export const CONFIG = Object.freeze({
  api: Object.freeze({
    baseUrl: "https://seguitubus.trescruces.com.uy/api/auth/app",
    busesEndpoint: "WSlistservmap",
    versionEndpoint: "WSversion",
    appVersion: "7.0",
    applicationId: "trescruces.com.seguitubus",
    useAuth: false,
    authToken: "",
    authHeader: "Authorization",
    sendXhrHeader: false,
    extraHeaders: Object.freeze({}),
    filters: Object.freeze({}),
    requestTimeoutMs: 15000
  }),
  map: Object.freeze({
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    tileSubdomains: "abc",
    tileMaxZoom: 19,
    tileFilter: "grayscale(1) brightness(1.12) contrast(.8)",
    defaultCenter: Object.freeze([-34.5228, -56.2778]),
    defaultZoom: 11,
    locationZoom: 13,
    geolocationTimeoutMs: 6000,
    markerRadius: 6
  }),
  refresh: Object.freeze({
    intervalMs: 10000,
    maxBackoffMs: 60000,
    pauseWhenHidden: true
  }),
  fields: Object.freeze({
    latitude: null,
    longitude: null,
    id: null,
    company: null
  }),
  logging: Object.freeze({
    level: "debug",
    maxLines: 300,
    rawSample: true
  })
});
