"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Input, Link } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { isValidPin, mapsUrl, pinFromText, RADIUS_MAX, RADIUS_MIN, round6 } from "@/utils/attendance/location";

/** A branch's pin and radius as typed (strings, so a half-typed number is kept). */
export interface LocationDraft {
  lat: string;
  lng: string;
  radius: string;
}

export const locationDraftOf = (branch: Pick<Branch, "geo_lat" | "geo_lng" | "checkin_radius_m">): LocationDraft => ({
  lat: branch.geo_lat === null ? "" : String(branch.geo_lat),
  lng: branch.geo_lng === null ? "" : String(branch.geo_lng),
  radius: String(branch.checkin_radius_m),
});

type LocationProblem = "pinIncomplete" | "latInvalid" | "lngInvalid" | "radiusInvalid";

/** What is wrong with the draft, per field (the API checks the same). */
export const locationProblems = (draft: LocationDraft): Partial<Record<"lat" | "lng" | "radius", LocationProblem>> => {
  const problems: Partial<Record<"lat" | "lng" | "radius", LocationProblem>> = {};
  const lat = draft.lat.trim();
  const lng = draft.lng.trim();
  if (Boolean(lat) !== Boolean(lng)) problems[lat ? "lng" : "lat"] = "pinIncomplete";
  if (lat && !(Number.isFinite(Number(lat)) && Math.abs(Number(lat)) <= 90)) problems.lat = "latInvalid";
  if (lng && !(Number.isFinite(Number(lng)) && Math.abs(Number(lng)) <= 180)) problems.lng = "lngInvalid";
  const radius = Number(draft.radius);
  if (!Number.isInteger(radius) || radius < RADIUS_MIN || radius > RADIUS_MAX) problems.radius = "radiusInvalid";
  return problems;
};

/** The API body for the draft: a pin (or null to clear it) and the radius. */
export const locationBody = (draft: LocationDraft) => ({
  geo_lat: draft.lat.trim() ? round6(Number(draft.lat)) : null,
  geo_lng: draft.lng.trim() ? round6(Number(draft.lng)) : null,
  checkin_radius_m: Number(draft.radius),
});

export const sameLocation = (a: LocationDraft, b: LocationDraft) =>
  JSON.stringify(locationBody(a)) === JSON.stringify(locationBody(b));

interface LocationFieldsProps {
  value: LocationDraft;
  onChange: (value: LocationDraft) => void;
  disabled?: boolean;
}

type Locating = { state: "idle" } | { state: "busy" } | { state: "done"; accuracy: number } | { state: "failed" };

/**
 * The pin and check-in radius of a branch (ATT-15) without a map: paste a Google Maps link, use
 * this device's location (when standing at the branch), or type the coordinates; then check the
 * pin on Google Maps.
 */
const LocationFields = ({ value, onChange, disabled = false }: LocationFieldsProps) => {
  const t = useTranslations("branches.location");
  const format = useFormat();
  const [link, setLink] = useState("");
  const [linkFailed, setLinkFailed] = useState(false);
  const [locating, setLocating] = useState<Locating>({ state: "idle" });
  const problems = locationProblems(value);
  const pin = value.lat.trim() && value.lng.trim() ? { lat: Number(value.lat), lng: Number(value.lng) } : null;

  const readLink = (text: string) => {
    setLink(text);
    const found = pinFromText(text);
    setLinkFailed(Boolean(text.trim()) && !found);
    if (found) onChange({ ...value, lat: String(found.lat), lng: String(found.lng) });
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating({ state: "failed" });
      return;
    }
    setLocating({ state: "busy" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ ...value, lat: String(round6(position.coords.latitude)), lng: String(round6(position.coords.longitude)) });
        setLocating({ state: "done", accuracy: Math.round(position.coords.accuracy) });
      },
      () => setLocating({ state: "failed" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {!disabled ? (
        <div className="flex flex-col gap-2">
          <Input
            label={t("link")}
            hint={t("linkHint")}
            value={link}
            autoComplete="off"
            inputMode="url"
            error={linkFailed ? t("linkFailed") : undefined}
            onChange={(event) => readLink(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} loading={locating.state === "busy"}>
              {t("useMine")}
            </Button>
            <span className="text-caption text-ink-muted" role="status">
              {locating.state === "done"
                ? t("located", { accuracy: format.number(locating.accuracy) })
                : locating.state === "failed"
                  ? t("locateFailed")
                  : t("useMineHint")}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("lat")}
          value={value.lat}
          inputMode="decimal"
          autoComplete="off"
          placeholder="23.757700"
          disabled={disabled}
          error={problems.lat ? t(`errors.${problems.lat}`) : undefined}
          onChange={(event) => onChange({ ...value, lat: event.target.value })}
        />
        <Input
          label={t("lng")}
          value={value.lng}
          inputMode="decimal"
          autoComplete="off"
          placeholder="90.389700"
          disabled={disabled}
          error={problems.lng ? t(`errors.${problems.lng}`) : undefined}
          onChange={(event) => onChange({ ...value, lng: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-body-sm">
        {pin && isValidPin(pin) ? (
          <>
            <Link href={mapsUrl(pin)} external>
              {t("check")}
            </Link>
            {!disabled ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, lat: "", lng: "" })}>
                {t("clear")}
              </Button>
            ) : null}
          </>
        ) : (
          <span className="text-ink-muted">{t("noPin")}</span>
        )}
      </div>

      <Input
        label={t("radius")}
        hint={t("radiusHint", { min: format.number(RADIUS_MIN), max: format.number(RADIUS_MAX) })}
        type="number"
        inputMode="numeric"
        min={RADIUS_MIN}
        max={RADIUS_MAX}
        step={1}
        trailing={t("metres")}
        value={value.radius}
        disabled={disabled}
        error={problems.radius ? t("errors.radiusInvalid", { min: format.number(RADIUS_MIN), max: format.number(RADIUS_MAX) }) : undefined}
        onChange={(event) => onChange({ ...value, radius: event.target.value })}
      />
    </div>
  );
};

export default LocationFields;
