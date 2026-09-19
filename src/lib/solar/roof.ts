/**
 * Fuentes de datos de cubierta.
 *
 * El preestudio mejora mucho si se conoce la cubierta real: superficie util,
 * inclinacion, orientacion y sombras. Hay tres maneras de saberlo, de mejor a
 * peor, y el sistema debe funcionar con cualquiera de ellas y declarar cual
 * ha usado.
 *
 * Estado actual: **Google Solar esta implementado pero desactivado**. Requiere
 * una cuenta de facturacion y se cobra por consulta, asi que sin clave el
 * adaptador se declara no configurado y el sistema cae a la superficie que
 * declare el usuario. Encender la integracion es poner la clave en el entorno;
 * no hay que tocar el motor ni la interfaz.
 *
 * Aviso para quien retome esto: el cliente de Google Solar se ha escrito
 * contra la documentacion, no contra el servicio. No esta verificado en vivo,
 * a diferencia del de PVGIS. Antes de darlo por bueno hay que ejecutarlo una
 * vez con clave real y confirmar la forma de la respuesta.
 */

import { STUDY_DEFAULTS } from "./assumptions";
import type { Confidence, Location, Provenance } from "./types";

export interface RoofInsight {
  /**
   * Superficie **neta** utilizable para modulos, en m2.
   *
   * Siempre neta, venga de donde venga. Google Solar ya la devuelve neta;
   * lo que declara un usuario es bruto y se convierte en `declaredRoof`.
   * El motor confia en esa invariante y no vuelve a descontar nada.
   */
  usableAreaM2?: number;
  /** Inclinacion dominante de la cubierta, en grados. */
  tiltDeg?: number;
  /** Orientacion dominante, convencion PVGIS: 0 = sur. */
  azimuthDeg?: number;
  /** Numero maximo de modulos que caben segun la fuente. */
  maxPanels?: number;
  provenance: Provenance;
  confidence: Confidence;
  /** Que no sabemos todavia y hay que confirmar en la visita tecnica. */
  caveats: string[];
}

export interface RoofDataSource {
  readonly id: string;
  readonly label: string;
  /** Si no esta configurada, `resolveRoof` la salta en silencio. */
  isConfigured(): boolean;
  fetch(location: Location, signal?: AbortSignal): Promise<RoofInsight | null>;
}

export class RoofSourceNotConfiguredError extends Error {
  constructor(sourceId: string) {
    super(`La fuente de cubierta "${sourceId}" no esta configurada`);
    this.name = "RoofSourceNotConfiguredError";
  }
}

/** Avisos que ninguna fuente remota puede resolver. Siempre requieren visita. */
const CAVEATS_SIEMPRE = [
  "Estado estructural de la cubierta y presencia de fibrocemento o amianto.",
  "Situacion del cuadro electrico, la acometida y la distancia al punto de conexion.",
];

/**
 * Google Solar API. Da segmentos de cubierta medidos sobre imagen aerea:
 * superficie, inclinacion, orientacion y capacidad de modulos.
 *
 * Limitaciones que el diseno debe respetar aunque se active:
 * - Se cobra por consulta, de modo que conviene cachear por coordenada.
 * - La cobertura en Espana es parcial: hay municipios sin datos.
 * - Sus condiciones de uso restringen el almacenamiento y la reutilizacion de
 *   los datos derivados. Antes de persistir nada hay que revisarlas.
 */
export const googleSolarSource: RoofDataSource = {
  id: "google_solar",
  label: "Google Solar API",

  isConfigured() {
    return Boolean(process.env.GOOGLE_SOLAR_API_KEY);
  },

  async fetch(location, signal) {
    const key = process.env.GOOGLE_SOLAR_API_KEY;
    if (!key) throw new RoofSourceNotConfiguredError(this.id);

    const params = new URLSearchParams({
      "location.latitude": location.latitude.toFixed(6),
      "location.longitude": location.longitude.toFixed(6),
      requiredQuality: "HIGH",
      key,
    });

    const response = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?${params.toString()}`,
      { signal },
    );

    // 404 significa que no hay cobertura en ese punto, no que haya fallado.
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Google Solar respondio ${response.status}`);
    }

    const payload: unknown = await response.json();
    return parseGoogleSolar(payload);
  },
};

/** Extraido aparte para poder probarlo con respuestas grabadas. */
export function parseGoogleSolar(payload: unknown): RoofInsight | null {
  if (typeof payload !== "object" || payload === null) return null;

  const potential = (payload as Record<string, unknown>).solarPotential;
  if (typeof potential !== "object" || potential === null) return null;

  const p = potential as Record<string, unknown>;
  const maxPanels = typeof p.maxArrayPanelsCount === "number" ? p.maxArrayPanelsCount : undefined;
  const usableAreaM2 = typeof p.maxArrayAreaMeters2 === "number" ? p.maxArrayAreaMeters2 : undefined;

  // Se toma el segmento de mayor superficie como orientacion dominante.
  let tiltDeg: number | undefined;
  let azimuthDeg: number | undefined;
  const segments = p.roofSegmentStats;
  if (Array.isArray(segments) && segments.length > 0) {
    let best: Record<string, unknown> | undefined;
    let bestArea = -1;
    for (const raw of segments) {
      if (typeof raw !== "object" || raw === null) continue;
      const segment = raw as Record<string, unknown>;
      const stats = segment.stats;
      const area =
        typeof stats === "object" && stats !== null
          ? Number((stats as Record<string, unknown>).areaMeters2)
          : Number.NaN;
      if (Number.isFinite(area) && area > bestArea) {
        bestArea = area;
        best = segment;
      }
    }
    if (best) {
      const pitch = Number(best.pitchDegrees);
      const azimuth = Number(best.azimuthDegrees);
      if (Number.isFinite(pitch)) tiltDeg = pitch;
      // Google mide el azimut desde el norte; PVGIS lo mide desde el sur.
      if (Number.isFinite(azimuth)) azimuthDeg = normaliseAzimuth(azimuth - 180);
    }
  }

  if (usableAreaM2 === undefined && maxPanels === undefined && tiltDeg === undefined) {
    return null;
  }

  return {
    usableAreaM2,
    tiltDeg,
    azimuthDeg,
    maxPanels,
    provenance: {
      source: "catalogo",
      detail: "Google Solar API, segmentos de cubierta medidos sobre imagen aerea.",
      retrievedAt: new Date().toISOString(),
    },
    confidence: "media",
    caveats: [
      "La imagen aerea puede tener meses o anos de antiguedad.",
      ...CAVEATS_SIEMPRE,
    ],
  };
}

/** Lleva cualquier angulo al rango (-180, 180]. */
export function normaliseAzimuth(degrees: number): number {
  let value = degrees % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;
  return value;
}

/**
 * Superficie declarada por el propio usuario. Fuente debil pero utilizable.
 *
 * Lo que mide una persona es la superficie **bruta** del tejado. Aqui se
 * descuenta la fraccion no aprovechable —chimeneas, retranqueos, pasillos de
 * mantenimiento, faldones mal orientados— para devolver superficie neta, que
 * es lo unico que el motor sabe interpretar.
 */
export function declaredRoof(
  grossAreaM2: number,
  usableFraction: number = STUDY_DEFAULTS.usableRoofFraction,
): RoofInsight {
  return {
    usableAreaM2: grossAreaM2 * usableFraction,
    provenance: {
      source: "supuesto",
      detail: `Superficie declarada por el usuario: ${grossAreaM2} m² brutos, de los que se consideran aprovechables el ${Math.round(usableFraction * 100)} %.`,
    },
    confidence: "baja",
    caveats: [
      "Superficie no verificada. No distingue zonas mal orientadas ni obstaculos.",
      "Orientacion e inclinacion desconocidas: el calculo usa la geometria optima teorica.",
      ...CAVEATS_SIEMPRE,
    ],
  };
}

/** No sabemos nada de la cubierta. Es un resultado valido, no un error. */
export function unknownRoof(): RoofInsight {
  return {
    provenance: {
      source: "supuesto",
      detail: "Sin datos de cubierta. Dimensionado guiado solo por el consumo.",
    },
    confidence: "baja",
    caveats: [
      "No se ha comprobado que la cubierta admita la potencia propuesta.",
      "Orientacion e inclinacion desconocidas: el calculo usa la geometria optima teorica.",
      ...CAVEATS_SIEMPRE,
    ],
  };
}

/**
 * Resuelve la cubierta probando las fuentes automaticas disponibles y cayendo
 * hacia atras de forma ordenada. Nunca lanza por falta de configuracion: una
 * fuente apagada es un escenario normal, no una averia.
 */
export async function resolveRoof(
  location: Location,
  options: {
    declaredAreaM2?: number;
    sources?: RoofDataSource[];
    signal?: AbortSignal;
    /** Gancho de observabilidad: una fuente caida deberia poder registrarse. */
    onSourceError?: (sourceId: string, error: unknown) => void;
  } = {},
): Promise<RoofInsight> {
  const sources = options.sources ?? [googleSolarSource];
  const caidas: string[] = [];

  for (const source of sources) {
    if (!source.isConfigured()) continue;
    try {
      const insight = await source.fetch(location, options.signal);
      if (insight) return insight;
    } catch (error) {
      // Una fuente caida degrada la calidad del preestudio, no lo impide.
      // Pero no se traga en silencio: queda anotado en el resultado, porque
      // si no, un preestudio degradado es indistinguible de uno normal.
      caidas.push(source.label);
      options.onSourceError?.(source.id, error);
      continue;
    }
  }

  const fallback =
    options.declaredAreaM2 !== undefined
      ? declaredRoof(options.declaredAreaM2)
      : unknownRoof();

  if (caidas.length > 0) {
    fallback.caveats = [
      `No se ha podido consultar ${caidas.join(", ")}. El dimensionado se ha hecho sin datos medidos de la cubierta.`,
      ...fallback.caveats,
    ];
  }

  return fallback;
}
