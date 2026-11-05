/** A pin: latitude and longitude in degrees. */
export interface Pin {
  lat: number;
  lng: number;
}

/** The check-in radius limits (ATT-15), the same as the API's. */
export const RADIUS_MIN = 25;
export const RADIUS_MAX = 1000;

const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`;
const PAIR = new RegExp(String.raw`(${NUMBER})\s*,\s*(${NUMBER})`);
/** Google Maps writes the place itself as !3d<lat>!4d<lng>; prefer it over the map's centre (@lat,lng). */
const PLACE = new RegExp(String.raw`!3d(${NUMBER})!4d(${NUMBER})`);
const CENTRE = new RegExp(String.raw`@(${NUMBER}),(${NUMBER})`);
const QUERY = new RegExp(String.raw`[?&](?:q|query|ll|center|destination)=(${NUMBER})(?:,|%2C)(${NUMBER})`, "i");

export const isValidPin = ({ lat, lng }: Pin): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * The pin in a pasted Google Maps (or OpenStreetMap) link, or in plain "23.7577, 90.3897" text.
 * Short links (maps.app.goo.gl) hold no coordinates and give null: open them and copy the full link.
 */
export const pinFromText = (text: string): Pin | null => {
  const value = text.trim();
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the text as pasted.
  }
  for (const pattern of [PLACE, CENTRE, QUERY, PAIR]) {
    const match = decoded.match(pattern);
    if (match) {
      const pin = { lat: Number(match[1]), lng: Number(match[2]) };
      if (isValidPin(pin)) return { lat: round6(pin.lat), lng: round6(pin.lng) };
    }
  }
  // OpenStreetMap: #map=<zoom>/<lat>/<lng> or ?mlat=..&mlon=..
  const osm = decoded.match(new RegExp(String.raw`map=\d+/(${NUMBER})/(${NUMBER})`)) ?? decoded.match(new RegExp(String.raw`mlat=(${NUMBER}).*mlon=(${NUMBER})`));
  if (osm) {
    const pin = { lat: Number(osm[1]), lng: Number(osm[2]) };
    if (isValidPin(pin)) return { lat: round6(pin.lat), lng: round6(pin.lng) };
  }
  return null;
};

/** Six decimals (about 10 cm), as the API stores them. */
export const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** A Google Maps link that shows the pin, to check it. */
export const mapsUrl = ({ lat, lng }: Pin): string => `https://www.google.com/maps?q=${lat},${lng}`;
