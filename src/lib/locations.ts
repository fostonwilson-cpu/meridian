export type Location = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  blurb: string;
};

export const LOCATIONS: Location[] = [
  {
    id: "svalbard",
    name: "Longyearbyen",
    region: "Svalbard",
    lat: 78.2232,
    lng: 15.6267,
    blurb:
      "The world’s northernmost town, a dark-fjord settlement that lives through months of night.",
  },
  {
    id: "reykjavik",
    name: "Reykjavík",
    region: "Iceland",
    lat: 64.1466,
    lng: -21.9426,
    blurb:
      "Timber and corrugated iron at the edge of the Mid-Atlantic Ridge, under a low arctic sky.",
  },
  {
    id: "banff",
    name: "Banff",
    region: "Canada",
    lat: 51.1784,
    lng: -115.5708,
    blurb:
      "A railway town in the Rockies, where the Bow River cuts a green trench through limestone.",
  },
  {
    id: "kyoto",
    name: "Kyoto",
    region: "Japan",
    lat: 35.0116,
    lng: 135.7681,
    blurb:
      "A basin of timber temples still paced by the hills that watched the Heian court.",
  },
  {
    id: "lisbon",
    name: "Lisbon",
    region: "Portugal",
    lat: 38.7223,
    lng: -9.1393,
    blurb:
      "Seven hills of azulejo and river light, facing the Atlantic as if the sea were a second sky.",
  },
  {
    id: "marrakech",
    name: "Marrakech",
    region: "Morocco",
    lat: 31.6295,
    lng: -7.9811,
    blurb:
      "The red city: tanneries, courtyards, and a square that never quite sleeps.",
  },
  {
    id: "cappadocia",
    name: "Göreme",
    region: "Cappadocia",
    lat: 38.6431,
    lng: 34.8289,
    blurb:
      "Valleys of ash and pigeon-houses; chimneys of tuff under a balloon-strewn dawn.",
  },
  {
    id: "singapore",
    name: "Singapore",
    region: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    blurb:
      "A garden-state at the equator, stacked in steel, rain trees, and warm night rain.",
  },
  {
    id: "uyuni",
    name: "Salar de Uyuni",
    region: "Bolivia",
    lat: -20.1338,
    lng: -67.4891,
    blurb:
      "The world’s largest salt flat — a pale mirror stretched under a high desert sky.",
  },
  {
    id: "cape-town",
    name: "Cape Town",
    region: "South Africa",
    lat: -33.9249,
    lng: 18.4241,
    blurb:
      "A city pressed between a table of stone and two oceans meeting at the Cape.",
  },
  {
    id: "hobart",
    name: "Hobart",
    region: "Tasmania",
    lat: -42.8821,
    lng: 147.3272,
    blurb:
      "A harbor at the world’s edge, with kunanyi watching over the Derwent.",
  },
  {
    id: "queenstown",
    name: "Queenstown",
    region: "New Zealand",
    lat: -45.0312,
    lng: 168.6626,
    blurb:
      "A glacial lake town under the Southern Alps, built for looking up.",
  },
];

export function getLocation(id: string | null): Location | undefined {
  if (!id) return undefined;
  return LOCATIONS.find((item) => item.id === id);
}

export function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}  ${Math.abs(lng).toFixed(2)}°${ew}`;
}
