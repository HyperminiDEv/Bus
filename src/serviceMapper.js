import {
  asBoolean,
  cleanText,
  firstDate,
  firstText,
  firstTime,
  hasValue,
  pickValue,
  toFiniteNumber
} from "./utils.js";

const LAT_KEYS = Object.freeze(["lat", "latitud", "latitude", "y"]);
const LNG_KEYS = Object.freeze(["lng", "lon", "long", "longitud", "longitude", "x"]);
const ID_KEYS = Object.freeze(["idServicioActivo", "idServicioProg", "idCoche", "NumBus", "bus", "idbus", "id", "coche", "nrocoche", "matricula", "unidad", "nrobus"]);
const COMPANY_KEYS = Object.freeze(["Empresa", "EmpresaProp", "EmpresaServicioNombre", "empresa", "company", "operador"]);
const UNIT_KEYS = Object.freeze(["NumBus", "unidad", "nrobus", "bus", "coche", "nrocoche", "matricula"]);
const ORIGIN_KEYS = Object.freeze(["Origen", "origen", "CiudadOrigenNombre", "ciudadOrigenNombre"]);
const DESTINATION_KEYS = Object.freeze(["Destino", "destino", "CiudadDestinoNombre", "ciudadDestinoNombre"]);
const VARIANT_KEYS = Object.freeze(["VarianteServicioOk", "VarianteServicio", "variante", "tipoServicio"]);
const COMMENT_KEYS = Object.freeze(["comentarios", "observaciones"]);

const STATE_LABELS = Object.freeze({
  0: { label: "En servicio", tone: "active" },
  1: { label: "Programado", tone: "neutral" },
  2: { label: "Anunciado", tone: "active" },
  3: { label: "En plataforma", tone: "active" },
  4: { label: "En viaje", tone: "active" },
  5: { label: "Arribado", tone: "neutral" },
  6: { label: "Cancelado", tone: "warning" }
});

export function normalizeBusesResponse(payload, fieldConfig) {
  const array = findBestServiceArray(payload);
  if (!array) return [];
  return array
    .map((raw, index) => normalizeService(raw, index, fieldConfig))
    .filter(Boolean);
}

function normalizeService(raw, index, fieldConfig) {
  if (!raw || typeof raw !== "object") return null;
  const ll = coordsOf(raw, fieldConfig);
  if (!ll) return null;

  const company = cleanText(pickValue(raw, COMPANY_KEYS, fieldConfig.company)) || "Empresa sin dato";
  const unit = cleanText(pickValue(raw, UNIT_KEYS)) || "Sin dato";
  const origin = firstText(raw, ORIGIN_KEYS);
  const destination = firstText(raw, DESTINATION_KEYS);
  const idValue = pickValue(raw, ID_KEYS, fieldConfig.id);
  const id = hasValue(idValue) ? String(idValue) : `${company}-${unit}-${ll[0]}-${ll[1]}-${index}`;

  return {
    id,
    ll,
    company,
    unit,
    raw,
    passenger: {
      company,
      unit,
      origin,
      destination,
      route: routeLabel(origin, destination),
      platform: platformLabel(raw),
      variant: firstText(raw, VARIANT_KEYS),
      departure: scheduleValue(raw, "departure"),
      arrival: scheduleValue(raw, "arrival"),
      status: serviceStatus(raw),
      updated: cleanText(pickValue(raw, ["msjFechaHora", "fechaHora"])) || "Sin dato",
      note: firstText(raw, COMMENT_KEYS)
    }
  };
}

function coordsOf(source, fieldConfig) {
  let lat = toFiniteNumber(pickValue(source, LAT_KEYS, fieldConfig.latitude));
  let lng = toFiniteNumber(pickValue(source, LNG_KEYS, fieldConfig.longitude));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nestedLat = toFiniteNumber(pickValue(value, LAT_KEYS));
        const nestedLng = toFiniteNumber(pickValue(value, LNG_KEYS));
        if (Number.isFinite(nestedLat) && Number.isFinite(nestedLng)) {
          lat = nestedLat;
          lng = nestedLng;
          break;
        }
      }
      if (typeof value === "string" && /^\s*-?\d+[.,]\d+\s*[,;]\s*-?\d+[.,]\d+\s*$/.test(value)) {
        const parts = value.split(/[;,](?=\s*-?\d)/);
        if (parts.length === 2) {
          lat = toFiniteNumber(parts[0]);
          lng = toFiniteNumber(parts[1]);
          break;
        }
      }
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return [lat, lng];
}

function findBestServiceArray(payload) {
  const candidates = [];
  collectArrays(payload, 0, candidates);
  return candidates
    .map(array => ({ array, score: scoreArray(array) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.array || null;
}

function collectArrays(node, depth, candidates) {
  if (depth > 6 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    candidates.push(node);
    for (const item of node.slice(0, 5)) collectArrays(item, depth + 1, candidates);
    return;
  }
  for (const key of Object.keys(node)) collectArrays(node[key], depth + 1, candidates);
}

function scoreArray(array) {
  const sample = array.slice(0, 20).filter(item => item && typeof item === "object" && !Array.isArray(item));
  if (!sample.length) return 0;
  const withCoords = sample.filter(item => coordsOf(item, {})).length;
  if (!withCoords) return 0;
  const withPassengerData = sample.filter(item =>
    hasValue(pickValue(item, COMPANY_KEYS)) ||
    hasValue(pickValue(item, UNIT_KEYS)) ||
    hasValue(pickValue(item, ORIGIN_KEYS)) ||
    hasValue(pickValue(item, DESTINATION_KEYS))
  ).length;
  if (!withPassengerData) return 0;
  return withCoords * 10 + withPassengerData * 6 + Math.min(array.length, 100);
}

function routeLabel(origin, destination) {
  if (origin && destination) return `${origin} a ${destination}`;
  return origin || destination || "Recorrido sin dato";
}

function platformLabel(raw) {
  const assigned = positiveInteger(pickValue(raw, ["plataforma"]));
  const last = positiveInteger(pickValue(raw, ["ultimaPlataforma"]));
  const fallback = positiveInteger(pickValue(raw, ["idPlataformaAsig"]));
  const value = assigned || last || fallback;
  return value ? String(value) : "A confirmar";
}

function positiveInteger(value) {
  const number = toFiniteNumber(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function scheduleValue(raw, type) {
  if (type === "departure") {
    return firstTime(raw, ["HoraInicioTeoricaTime", "HoraInicioTeorica", "HoraPartidaProg", "HoraPartidaReal"]) || "Sin dato";
  }

  return firstTime(raw, ["HoraFinTeoricaTime", "HoraFinTeorica", "HoraLlegadaProg", "HoraLlegadaReal"]) || "Sin dato";
}

function serviceStatus(raw) {
  if (asBoolean(pickValue(raw, ["alertFechaHora"]))) {
    return { label: "Ubicación desactualizada", tone: "warning" };
  }

  const now = new Date();
  const departureReal = firstDate(raw, ["HoraPartidaReal"]);
  const start = firstDate(raw, ["HoraInicioTeorica", "HoraPartidaProg"]);
  const end = firstDate(raw, ["HoraFinTeorica", "HoraLlegadaProg"]);

  if (departureReal || (start && now >= start)) {
    return { label: "En viaje", tone: "active" };
  }
  if (asBoolean(pickValue(raw, ["anunciado"]))) {
    return { label: "Anunciado", tone: "active" };
  }
  if (start && now < start) {
    return { label: "Programado", tone: "neutral" };
  }
  if (end && now > end) {
    return { label: "En servicio", tone: "active" };
  }

  const state = cleanText(pickValue(raw, ["estado", "Estado"]));
  return STATE_LABELS[state] || { label: "En servicio", tone: "active" };
}
