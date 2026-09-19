/**
 * Geocodificacion de direcciones.
 *
 * Se usa Nominatim, el geocodificador de OpenStreetMap: publico, sin clave y
 * suficiente para un preestudio, donde basta con situar el tejado en el mapa
 * de radiacion. Su politica de uso exige un User-Agent identificable y limita
 * a una peticion por segundo, asi que no sirve para volumen: en produccion se
 * sustituye por un geocodificador contratado sin tocar nada fuera de este
 * fichero.
 */

import { memoizeAsync, withTimeout } from "../cache";
import type { Location } from "./types";

const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";

/** Nominatim es un servicio comunitario: ni rapido garantizado ni ilimitado. */
const DEFAULT_TIMEOUT_MS = 7000;

export class GeocodeError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GeocodeError";
  }
}

export interface GeocodeResult extends Location {
  formattedAddress: string;
  /** Tipo de resultado devuelto: casa, calle, municipio. */
  precision: string;
  /**
   * Una direccion resuelta a nivel de municipio no sirve para dimensionar:
   * la radiacion apenas cambia, pero la cubierta es otra.
   */
  isPreciseEnough: boolean;
}

const PRECISE_TYPES = new Set(["house", "building", "residential", "address", "amenity", "shop"]);

export async function geocodeAddress(
  query: string,
  options: {
    baseUrl?: string;
    userAgent?: string;
    countryCodes?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return null;

  const baseUrl = options.baseUrl ?? process.env.NOMINATIM_BASE_URL ?? DEFAULT_BASE_URL;
  const userAgent =
    options.userAgent ?? process.env.GEOCODER_USER_AGENT ?? "solarpilot-portfolio-demo";
  const doFetch = options.fetchImpl ?? fetch;

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    countrycodes: options.countryCodes ?? "es",
  });

  let response: Response;
  try {
    response = await doFetch(`${baseUrl}/search?${params.toString()}`, {
      signal: withTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal),
      headers: { "User-Agent": userAgent, "Accept-Language": "es" },
    });
  } catch (cause) {
    const agotado = cause instanceof Error && cause.name === "TimeoutError";
    throw new GeocodeError(
      agotado
        ? "El geocodificador ha tardado mas de lo aceptable en responder"
        : "No se ha podido contactar con el geocodificador",
      cause,
    );
  }

  if (!response.ok) {
    throw new GeocodeError(`El geocodificador respondio ${response.status}`);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!Array.isArray(payload) || payload.length === 0) return null;

  const first = payload[0];
  if (typeof first !== "object" || first === null) return null;

  const row = first as Record<string, unknown>;
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new GeocodeError("El geocodificador devolvio coordenadas no validas");
  }

  const precision = typeof row.type === "string" ? row.type : "desconocido";
  const category = typeof row.category === "string" ? row.category : "";

  return {
    latitude,
    longitude,
    formattedAddress:
      typeof row.display_name === "string" ? row.display_name : trimmed,
    precision,
    isPreciseEnough: PRECISE_TYPES.has(precision) || category === "building",
  };
}

/**
 * Version cacheada de `geocodeAddress`.
 *
 * Ademas de ahorrar llamadas, protege el limite de una peticion por segundo
 * que impone la politica de uso de Nominatim: reintentar el mismo texto no
 * cuenta como peticion nueva.
 */
export const geocodeAddressCached = memoizeAsync(
  geocodeAddress,
  (query) => query.trim().toLowerCase().replace(/\s+/g, " "),
  { ttlMs: 24 * 60 * 60 * 1000 },
);
