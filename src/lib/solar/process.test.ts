import { describe, expect, it } from "vitest";

import {
  formatDuration,
  OWNER_LABELS,
  PROCESS_STEPS,
  stepsFor,
  totalDuration,
} from "./process";

describe("catalogo de pasos", () => {
  it("cada paso declara quien lo ejecuta", () => {
    for (const paso of PROCESS_STEPS) {
      expect(OWNER_LABELS[paso.owner]).toBeTruthy();
    }
  });

  it("cada paso dice que puede salir mal", () => {
    // Un proceso sin riesgos declarados es un folleto, no informacion util.
    for (const paso of PROCESS_STEPS) {
      expect(paso.risks.length).toBeGreaterThan(0);
    }
  });

  it("cada paso genera o exige algun documento", () => {
    for (const paso of PROCESS_STEPS) {
      expect(paso.documents.length).toBeGreaterThan(0);
    }
  });

  it("los identificadores no se repiten", () => {
    const ids = PROCESS_STEPS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("los plazos son coherentes: el minimo nunca supera al maximo", () => {
    for (const paso of PROCESS_STEPS) {
      if (!paso.duration) continue;
      expect(paso.duration.minDays).toBeLessThanOrEqual(paso.duration.maxDays);
      expect(paso.duration.minDays).toBeGreaterThanOrEqual(0);
    }
  });

  it("las fuentes citadas llevan fecha de consulta", () => {
    for (const paso of PROCESS_STEPS) {
      if (!paso.source) continue;
      expect(paso.source.url).toMatch(/^https:\/\//);
      expect(paso.source.consultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("empieza en el preestudio y termina en la puesta en marcha", () => {
    expect(PROCESS_STEPS[0]?.id).toBe("preestudio");
    expect(PROCESS_STEPS[PROCESS_STEPS.length - 1]?.id).toBe("puesta_en_marcha");
  });
});

describe("stepsFor", () => {
  it("sin excedentes se saltan los tramites que solo aplican con ellos", () => {
    const con = stepsFor(true);
    const sin = stepsFor(false);
    expect(sin.length).toBeLessThan(con.length);
    expect(sin.find((p) => p.id === "conexion")).toBeUndefined();
    expect(sin.find((p) => p.id === "compensacion")).toBeUndefined();
  });

  it("todo paso condicional explica cuando aplica", () => {
    const condicionales = PROCESS_STEPS.filter((p) => p.appliesWhen);
    expect(condicionales.length).toBeGreaterThan(0);
    for (const paso of condicionales) {
      expect(paso.appliesWhen).toMatch(/\S/);
    }
  });
});

describe("totalDuration", () => {
  it("el recorrido con excedentes es mas largo que sin ellos", () => {
    expect(totalDuration(true).maxDays).toBeGreaterThan(totalDuration(false).maxDays);
  });

  it("el minimo nunca supera al maximo", () => {
    for (const conExcedentes of [true, false]) {
      const t = totalDuration(conExcedentes);
      expect(t.minDays).toBeLessThanOrEqual(t.maxDays);
    }
  });

  it("separa el plazo que no depende de la instaladora", () => {
    const t = totalDuration(true);
    expect(t.outOfControlMaxDays).toBeGreaterThan(0);
    expect(t.outOfControlMaxDays).toBeLessThanOrEqual(t.maxDays);
  });

  it("buena parte del plazo esta en manos de terceros", () => {
    // Es el dato que desmonta la promesa de "en dos semanas lo tienes".
    const t = totalDuration(true);
    expect(t.outOfControlMaxDays / t.maxDays).toBeGreaterThan(0.4);
  });

  it("la suma coincide con el detalle de los pasos", () => {
    const t = totalDuration(true);
    const suma = PROCESS_STEPS.reduce(
      (acc, p) => ({
        min: acc.min + (p.duration?.minDays ?? 0),
        max: acc.max + (p.duration?.maxDays ?? 0),
      }),
      { min: 0, max: 0 },
    );
    expect(t.minDays).toBe(suma.min);
    expect(t.maxDays).toBe(suma.max);
  });
});

describe("formatDuration", () => {
  it("los plazos cortos se expresan en dias", () => {
    expect(formatDuration({ minDays: 3, maxDays: 7 })).toBe("3–7 días");
    expect(formatDuration({ minDays: 5, maxDays: 10 })).toBe("5–10 días");
  });

  it("los plazos largos se expresan en semanas", () => {
    expect(formatDuration({ minDays: 7, maxDays: 30 })).toBe("1–5 semanas");
    expect(formatDuration({ minDays: 15, maxDays: 60 })).toBe("2–9 semanas");
  });

  it("nunca dice cero semanas", () => {
    // 3 a 15 dias redondeaba a "0 a 2 semanas": ningun tramite dura cero
    // semanas. En dias si puede ser cero —el preestudio es inmediato—, de
    // modo que la prohibicion aplica solo a la unidad semanal.
    expect(formatDuration({ minDays: 3, maxDays: 15 })).toBe("1–3 semanas");
    for (const paso of PROCESS_STEPS) {
      expect(formatDuration(paso.duration)).not.toMatch(/\b0[–-]\d+\s+semanas/);
    }
  });

  it("no produce rangos que no informan", () => {
    // "1 a 1 semanas" era el sintoma de redondear un plazo corto.
    for (const paso of PROCESS_STEPS) {
      expect(formatDuration(paso.duration)).not.toMatch(/^(\d+)–\1\s/);
    }
  });

  it("colapsa el rango cuando ambos extremos coinciden", () => {
    expect(formatDuration({ minDays: 5, maxDays: 5 })).toBe("5 días");
    expect(formatDuration({ minDays: 14, maxDays: 14 })).toBe("2 semanas");
  });

  it("redondea el maximo hacia arriba: quedarse corto es el error que se nota", () => {
    expect(formatDuration({ minDays: 8, maxDays: 22 })).toBe("1–4 semanas");
  });

  it("sin plazo propio devuelve un guion", () => {
    expect(formatDuration(null)).toBe("—");
  });
});
