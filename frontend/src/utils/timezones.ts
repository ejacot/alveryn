const FALLBACK_TIMEZONES = [
  "Europe/Berlin",
  "Europe/Bucharest",
  "Europe/London",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Tokyo",
  "UTC"
];

export function getSupportedTimezones() {
  if (
    typeof Intl !== "undefined" &&
    "supportedValuesOf" in Intl &&
    typeof Intl.supportedValuesOf === "function"
  ) {
    try {
      const values = Intl.supportedValuesOf("timeZone");
      if (values.length > 0) {
        return values;
      }
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }

  return FALLBACK_TIMEZONES;
}
