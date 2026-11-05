import { describe, expect, it } from "vitest";
import { isValidPin, mapsUrl, pinFromText } from "./location";

describe("pinFromText", () => {
  it("reads the place from a full Google Maps link before the map centre", () => {
    expect(
      pinFromText("https://www.google.com/maps/place/Farmgate/@23.7570000,90.3870000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d23.7577123!4d90.3897456"),
    ).toEqual({ lat: 23.757712, lng: 90.389746 });
    expect(pinFromText("https://www.google.com/maps/@23.8103,90.4125,15z")).toEqual({ lat: 23.8103, lng: 90.4125 });
  });

  it("reads ?q= links, encoded commas, plain coordinates and OpenStreetMap links", () => {
    expect(pinFromText("https://maps.google.com/?q=23.75,90.38")).toEqual({ lat: 23.75, lng: 90.38 });
    expect(pinFromText("https://www.google.com/maps/search/?api=1&query=23.75%2C90.38")).toEqual({ lat: 23.75, lng: 90.38 });
    expect(pinFromText(" 23.7577, 90.3897 ")).toEqual({ lat: 23.7577, lng: 90.3897 });
    expect(pinFromText("https://www.openstreetmap.org/#map=17/23.75770/90.38970")).toEqual({ lat: 23.7577, lng: 90.3897 });
  });

  it("gives null for short links, text without coordinates and impossible values", () => {
    expect(pinFromText("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(pinFromText("Farmgate, Dhaka")).toBeNull();
    expect(pinFromText("123.5, 90")).toBeNull();
    expect(pinFromText("")).toBeNull();
  });
});

describe("pins", () => {
  it("checks the ranges and builds a maps link", () => {
    expect(isValidPin({ lat: 90, lng: -180 })).toBe(true);
    expect(isValidPin({ lat: 90.1, lng: 0 })).toBe(false);
    expect(isValidPin({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(mapsUrl({ lat: 23.75, lng: 90.38 })).toBe("https://www.google.com/maps?q=23.75,90.38");
  });
});
