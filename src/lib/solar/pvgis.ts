/**
 * Cliente de PVGIS (Photovoltaic Geographical Information System),
 * el servicio de radiacion y produccion fotovoltaica del Joint Research
 * Centre de la Comision Europea.
 *
 * Por que PVGIS y no una estimacion propia: es una fuente oficial, publica,
 * sin clave de API, con series de radiacion medidas y cobertura total de
 * Espana. Un preestudio apoyado en PVGIS se puede defender; uno apoyado en
 * una constante inventada, no.
 *
 * Limites conocidos que el diseno debe respetar:
 * - Servicio publico sin SLA. Puede caer o limitar peticiones.
 * - No conoce la cubierta concreta: ni sombras propias, ni obstaculos, ni
 *   estado estructural. Eso lo aporta la visita tecnica o la Solar API.
 */

import type { ArrayGeometry, Location } from "./types";

const DEFAULT_BASE_URL = "https://re.jrc.ec.europa.eu/api/v5_2";

/** Perdidas del sistema en %. Cableado, inversor, suciedad, temperatura. */
export const DEFAULT_SYSTEM_LOSS_PERCENT = 14;

export interface PvgisProduction {
  /** kWh/ano por cada kWp instalado. El dato que hace de bisagra. */
  specificYieldKWhPerKWp: number;
  /** Reparto mensual de la produccion, en kWh por kWp. Doce posiciones. */
  monthlyPerKWp: number[];
  /** Inclinacion finalmente empleada. Puede venir calculada por PVGIS. */
  tiltDeg: number;
  /** Azimut finalmente empleado, convencion PVGIS: 0 = sur. */
  azimuthDeg: number;
  retrievedAt: string;
}

export class PvgisError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PvgisError";
  }
}

function toFiniteNumber(raw: unknown, field: string): number {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new PvgisError(`Campo no numerico en la respuesta de PVGIS: ${field}`);
  }
  return n;
}

/**
 * Consulta la produccion anual y mensual para una ubicacion.
 *
 * Se pide siempre con peakpower = 1 kWp para obtener el rendimiento
 * especifico y escalarlo despues. Asi una sola llamada sirve para cualquier
 * dimensionado y se puede cachear por coordenada y geometria.
 */
export async function fetchProduction(
  location: Location,
  geometry: ArrayGeometry,
  options: {
    baseUrl?: string;
    lossPercent?: number;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<PvgisProduction> {
  const baseUrl = options.baseUrl ?? process.env.PVGIS_BASE_URL ?? DEFAULT_BASE_URL;
  const doFetch = options.fetchImpl ?? fetch;

  const params = new URLSearchParams({
    lat: location.latitude.toFixed(5),
    lon: location.longitude.toFixed(5),
    peakpower: "1",
    loss: String(options.lossPercent ?? DEFAULT_SYSTEM_LOSS_PERCENT),
    pvtechchoice: "crystSi",
    mountingplace: "building",
    outputformat: "json",
  });

  if (geometry.useOptimalAngles) {
    params.set("optimalangles", "1");
  } else {
    params.set("angle", String(geometry.tiltDeg));
    params.set("aspect", String(geometry.azimuthDeg));
  }

  const url = `${baseUrl}/PVcalc?${params.toString()}`;

  let response: Response;
  try {
    response = await doFetch(url, { signal: options.signal });
  } catch (cause) {
    throw new PvgisError("No se ha podido contactar con PVGIS", cause);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PvgisError(
      `PVGIS respondio ${response.status}. ${body.slice(0, 200)}`.trim(),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new PvgisError("PVGIS devolvio una respuesta que no es JSON", cause);
  }

  return parseProduction(payload);
}

/**
 * Parseo defensivo. PVGIS es un servicio externo y su contrato puede cambiar
 * entre versiones, asi que se valida campo a campo en lugar de confiar en la
 * forma del objeto.
 */
export function parseProduction(payload: unknown): PvgisProduction {
  if (typeof payload !== "object" || payload === null) {
    throw new PvgisError("Respuesta de PVGIS vacia o no es un objeto");
  }

  const outputs = (payload as Record<string, unknown>).outputs;
  if (typeof outputs !== "object" || outputs === null) {
    throw new PvgisError("Respuesta de PVGIS sin bloque 'outputs'");
  }

  const totalsBlock = (outputs as Record<string, unknown>).totals;
  const fixedTotals =
    typeof totalsBlock === "object" && totalsBlock !== null
      ? (totalsBlock as Record<string, unknown>).fixed
      : undefined;
  if (typeof fixedTotals !== "object" || fixedTotals === null) {
    throw new PvgisError("Respuesta de PVGIS sin 'outputs.totals.fixed'");
  }

  const specificYieldKWhPerKWp = toFiniteNumber(
    (fixedTotals as Record<string, unknown>).E_y,
    "outputs.totals.fixed.E_y",
  );

  const monthlyBlock = (outputs as Record<string, unknown>).monthly;
  const monthlyFixed =
    typeof monthlyBlock === "object" && monthlyBlock !== null
      ? (monthlyBlock as Record<string, unknown>).fixed
      : undefined;
  if (!Array.isArray(monthlyFixed) || monthlyFixed.length !== 12) {
    throw new PvgisError("Respuesta de PVGIS sin doce meses en 'outputs.monthly.fixed'");
  }

  const monthlyPerKWp = monthlyFixed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new PvgisError(`Mes ${index + 1} con formato inesperado`);
    }
    return toFiniteNumber(
      (entry as Record<string, unknown>).E_m,
      `outputs.monthly.fixed[${index}].E_m`,
    );
  });

  const inputs = (payload as Record<string, unknown>).inputs;
  const mounting =
    typeof inputs === "object" && inputs !== null
      ? (inputs as Record<string, unknown>).mounting_system
      : undefined;
  const fixedMount =
    typeof mounting === "object" && mounting !== null
      ? (mounting as Record<string, unknown>).fixed
      : undefined;

  const readAngle = (key: "slope" | "azimuth"): number => {
    if (typeof fixedMount !== "object" || fixedMount === null) return 0;
    const node = (fixedMount as Record<string, unknown>)[key];
    if (typeof node !== "object" || node === null) return 0;
    const value = (node as Record<string, unknown>).value;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  return {
    specificYieldKWhPerKWp,
    monthlyPerKWp,
    tiltDeg: readAngle("slope"),
    azimuthDeg: readAngle("azimuth"),
    retrievedAt: new Date().toISOString(),
  };
}
