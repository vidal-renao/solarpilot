import { describe, expect, it } from "vitest";

import { STUDY_DEFAULTS } from "./assumptions";

import {
  declaredRoof,
  normaliseAzimuth,
  parseGoogleSolar,
  resolveRoof,
  unknownRoof,
  type RoofDataSource,
  type RoofInsight,
} from "./roof";
import type { Location } from "./types";

const MADRID: Location = { latitude: 40.4167, longitude: -3.7035 };

const source = (
  id: string,
  configured: boolean,
  result: RoofInsight | null | Error,
): RoofDataSource => ({
  id,
  label: id,
  isConfigured: () => configured,
  fetch: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
});

const insight = (area: number): RoofInsight => ({
  usableAreaM2: area,
  provenance: { source: "catalogo", detail: "prueba" },
  confidence: "media",
  caveats: [],
});

describe("normaliseAzimuth", () => {
  it("convierte el norte de Google en el sur de PVGIS", () => {
    // Google: 180 = sur. PVGIS: 0 = sur.
    expect(normaliseAzimuth(180 - 180)).toBe(0);
    // Google: 90 = este. PVGIS: -90.
    expect(normaliseAzimuth(90 - 180)).toBe(-90);
    // Google: 270 = oeste. PVGIS: 90.
    expect(normaliseAzimuth(270 - 180)).toBe(90);
  });

  it("mantiene cualquier angulo dentro del rango", () => {
    for (const angle of [-540, -181, -180, 0, 180, 181, 540, 725]) {
      const value = normaliseAzimuth(angle);
      expect(value).toBeGreaterThan(-180);
      expect(value).toBeLessThanOrEqual(180);
    }
  });
});

describe("parseGoogleSolar", () => {
  const respuesta = {
    solarPotential: {
      maxArrayPanelsCount: 34,
      maxArrayAreaMeters2: 61.4,
      roofSegmentStats: [
        { pitchDegrees: 15, azimuthDegrees: 95, stats: { areaMeters2: 12 } },
        { pitchDegrees: 30, azimuthDegrees: 180, stats: { areaMeters2: 48 } },
      ],
    },
  };

  it("toma el segmento de mayor superficie como orientacion dominante", () => {
    const parsed = parseGoogleSolar(respuesta);
    expect(parsed?.tiltDeg).toBe(30);
    expect(parsed?.azimuthDeg).toBe(0); // 180 de Google es sur, 0 en PVGIS
    expect(parsed?.maxPanels).toBe(34);
    expect(parsed?.usableAreaM2).toBeCloseTo(61.4);
  });

  it("devuelve null si no hay potencial solar en la respuesta", () => {
    expect(parseGoogleSolar({})).toBeNull();
    expect(parseGoogleSolar(null)).toBeNull();
    expect(parseGoogleSolar({ solarPotential: {} })).toBeNull();
  });

  it("aguanta segmentos con forma inesperada sin reventar", () => {
    const rara = {
      solarPotential: {
        maxArrayPanelsCount: 10,
        roofSegmentStats: [null, "texto", { stats: {} }],
      },
    };
    const parsed = parseGoogleSolar(rara);
    expect(parsed?.maxPanels).toBe(10);
    expect(parsed?.tiltDeg).toBeUndefined();
  });

  it("siempre advierte de lo que ninguna imagen aerea puede ver", () => {
    const parsed = parseGoogleSolar(respuesta);
    expect(parsed?.caveats.join(" ")).toMatch(/amianto/i);
    expect(parsed?.caveats.join(" ")).toMatch(/acometida/i);
  });
});

describe("resolveRoof: cadena de respaldo", () => {
  it("usa la fuente automatica cuando esta configurada", async () => {
    const roof = await resolveRoof(MADRID, {
      sources: [source("auto", true, insight(50))],
      declaredAreaM2: 20,
    });
    expect(roof.usableAreaM2).toBe(50);
  });

  it("salta en silencio una fuente apagada y cae a lo declarado", async () => {
    const roof = await resolveRoof(MADRID, {
      sources: [source("apagada", false, insight(50))],
      declaredAreaM2: 20,
    });
    // 20 m2 brutos declarados se convierten en netos al caer a `declaredRoof`.
    expect(roof.usableAreaM2).toBeCloseTo(20 * STUDY_DEFAULTS.usableRoofFraction);
    expect(roof.provenance.source).toBe("supuesto");
  });

  it("una fuente caida degrada el preestudio pero no lo impide", async () => {
    const roof = await resolveRoof(MADRID, {
      sources: [source("rota", true, new Error("502"))],
      declaredAreaM2: 20,
    });
    expect(roof.usableAreaM2).toBeCloseTo(20 * STUDY_DEFAULTS.usableRoofFraction);
  });

  it("sin cobertura en el punto, pasa a la siguiente fuente", async () => {
    const roof = await resolveRoof(MADRID, {
      sources: [source("sin_cobertura", true, null), source("segunda", true, insight(33))],
    });
    expect(roof.usableAreaM2).toBe(33);
  });

  it("no saber nada de la cubierta es un resultado valido, no un error", async () => {
    const roof = await resolveRoof(MADRID, { sources: [] });
    expect(roof.usableAreaM2).toBeUndefined();
    expect(roof.confidence).toBe("baja");
    expect(roof.caveats.length).toBeGreaterThan(0);
  });
});

describe("fuentes declarativas", () => {
  it("lo declarado por el usuario nunca pasa de confianza baja", () => {
    expect(declaredRoof(40).confidence).toBe("baja");
    expect(unknownRoof().confidence).toBe("baja");
  });

  it("convierte la superficie bruta declarada en superficie neta", () => {
    // El usuario mide el tejado entero; solo una parte admite modulos.
    expect(declaredRoof(100, 0.7).usableAreaM2).toBeCloseTo(70);
    expect(declaredRoof(100, 1).usableAreaM2).toBeCloseTo(100);
  });

  it("deja por escrito cuanto ha descontado", () => {
    expect(declaredRoof(100, 0.7).provenance.detail).toContain("70 %");
  });

  it("Google Solar entrega superficie ya neta y no se vuelve a descontar", () => {
    const parsed = parseGoogleSolar({
      solarPotential: { maxArrayAreaMeters2: 61.4, maxArrayPanelsCount: 34 },
    });
    expect(parsed?.usableAreaM2).toBeCloseTo(61.4);
  });

  it("advierte de que la geometria real se desconoce", () => {
    expect(declaredRoof(40).caveats.join(" ")).toMatch(/orientacion e inclinacion/i);
  });
});

describe("observabilidad de las fuentes", () => {
  it("deja constancia en el resultado de que una fuente fallo", async () => {
    const roof = await resolveRoof(MADRID, {
      sources: [source("Google Solar API", true, new Error("502"))],
      declaredAreaM2: 30,
    });
    expect(roof.caveats[0]).toMatch(/no se ha podido consultar/i);
    expect(roof.caveats[0]).toContain("Google Solar API");
  });

  it("avisa por el gancho de observabilidad con el error original", async () => {
    const vistos: Array<{ id: string; error: unknown }> = [];
    await resolveRoof(MADRID, {
      sources: [source("caida", true, new Error("502"))],
      onSourceError: (id, error) => vistos.push({ id, error }),
    });
    expect(vistos).toHaveLength(1);
    expect(vistos[0]?.id).toBe("caida");
    expect((vistos[0]?.error as Error).message).toBe("502");
  });

  it("no ensucia el resultado cuando ninguna fuente falla", async () => {
    const roof = await resolveRoof(MADRID, { sources: [], declaredAreaM2: 30 });
    expect(roof.caveats.join(" ")).not.toMatch(/no se ha podido consultar/i);
  });
});
