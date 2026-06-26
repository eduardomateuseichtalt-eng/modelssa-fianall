export const VISITOR_LOCATION_STORAGE_KEY = "modelsClubVisitorLocation";
export const VISITOR_LOCATION_EVENT = "modelsClub:visitor-location";

const cleanLocationValue = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength);

export function normalizeVisitorLocation(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    city: cleanLocationValue(source.city, 120),
    region: cleanLocationValue(source.region, 120),
    countryCode: cleanLocationValue(source.countryCode, 2).toUpperCase(),
  };
}

export function readVisitorLocation() {
  try {
    const stored = localStorage.getItem(VISITOR_LOCATION_STORAGE_KEY);
    if (stored) {
      return normalizeVisitorLocation(JSON.parse(stored));
    }
    return normalizeVisitorLocation({
      city: localStorage.getItem("modelsClubDetectedCity") || "",
    });
  } catch {
    return normalizeVisitorLocation({});
  }
}

export function saveVisitorLocation(value) {
  const location = normalizeVisitorLocation(value);
  try {
    localStorage.setItem(VISITOR_LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // A atualizacao da sessao continua funcionando quando o storage esta indisponivel.
  }

  window.dispatchEvent(new CustomEvent(VISITOR_LOCATION_EVENT, { detail: location }));
  return location;
}
