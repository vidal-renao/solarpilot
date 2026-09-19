import { describe, expect, it } from "vitest";

import { STUDY_DEFAULTS } from "./assumptions";
import {
  buildStudy,
  computeEconomics,
  estimateEnergyBalance,
  interpolateSelfConsumption,
  pricePerKWp,
  sizeSystem,
} from "./engine";
import { parseProduction, type PvgisProduction } from "./pvgis";
import type { StudyInput } from "./types";

/** Madrid, angulos optimos. Valores reales devueltos por PVGIS v5_2. */
const MADRID: PvgisProduction = {
  specificYieldKWhPerKWp: 1560.29,
  monthlyPerKWp: [
    103.33, 111.75, 147.65, 148.09, 152.53, 156.55, 168.46, 168.1, 147.18,
    126.35, 103.29, 97.01,
  ],
  tiltDeg: 37,
  azimuthDeg: -4,
  retrievedAt: "2026-09-19T10:00:00.000Z",
};

const baseInput = (overrides: Partial<StudyInput> = {}): StudyInput => ({
  location: { latitude: 40.4167, longitude: -3.7035 },
  consumption: { annualKWh: 4500, source: "factura" },
  tariff: { importPricePerKWh: 0.22, exportPricePerKWh: 0.06 },
  geometry: { tiltDeg: 30, azimuthDeg: 0, useOptimalAngles: true },
  ...overrides,
});

describe("interpolateSelfConsumption", () => {
  it("devuelve el extremo alto cuando no hay produccion", () => {
    expect(interpolateSelfConsumption(0)).toBe(1);
  });

  it("satura por debajo en ratios extremos en lugar de extrapolar", () => {
    expect(interpolateSelfConsumption(99)).toBe(0.23);
  });

  it("interpola linealmente entre dos puntos de la curva", () => {
    // Punto medio entre 0,75 -> 0,61 y 1,00 -> 0,52
    expect(interpolateSelfConsumption(0.875)).toBeCloseTo(0.565, 3);
  });

  it("es monotona decreciente: sobredimensionar siempre aprovecha menos", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ratio = 0; ratio <= 3; ratio += 0.05) {
      const current = interpolateSelfConsumption(ratio);
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
  });
});

describe("pricePerKWp", () => {
  it("aplica el tramo correspondiente al tamano", () => {
    expect(pricePerKWp(2)).toBe(1750);
    expect(pricePerKWp(5)).toBe(1500);
    expect(pricePerKWp(12)).toBe(1150);
    expect(pricePerKWp(500)).toBe(1050);
  });

  it("abarata el kWp segun crece la instalacion", () => {
    expect(pricePerKWp(20)).toBeLessThan(pricePerKWp(2));
  });
});

describe("sizeSystem", () => {
  it("dimensiona por consumo cuando nada mas limita", () => {
    const sizing = sizeSystem(baseInput(), MADRID);
    // 4500 * 0,8 / 1560,29 = 2,31 kWp -> 5 modulos de 450 Wp
    expect(sizing.panelCount).toBe(5);
    expect(sizing.recommendedKWp).toBe(2.25);
    expect(sizing.limitingFactor).toBe("consumo");
  });

  it("ajusta siempre a un numero entero de modulos", () => {
    for (const annualKWh of [1200, 3300, 7800, 15400, 42000]) {
      const sizing = sizeSystem(baseInput({ consumption: { annualKWh, source: "factura" } }), MADRID);
      expect(Number.isInteger(sizing.panelCount)).toBe(true);
      expect(sizing.recommendedKWp).toBeCloseTo(
        (sizing.panelCount * STUDY_DEFAULTS.panelWattsPeak) / 1000,
        6,
      );
    }
  });

  it("limita por superficie cuando la cubierta es pequena", () => {
    const sizing = sizeSystem(baseInput({ availableRoofAreaM2: 8 }), MADRID);
    expect(sizing.limitingFactor).toBe("superficie");
    // 8 m2 * 0,7 util / 4,667 m2 por kWp = 1,2 kWp -> 3 modulos
    expect(sizing.panelCount).toBe(3);
  });

  it("limita por el tope de potencia que imponga el cliente", () => {
    const sizing = sizeSystem(baseInput({ maxKWp: 1 }), MADRID);
    expect(sizing.limitingFactor).toBe("tope_potencia");
    expect(sizing.recommendedKWp).toBeLessThanOrEqual(1.125);
  });

  it("nunca baja de un modulo aunque el consumo sea minimo", () => {
    const sizing = sizeSystem(baseInput({ consumption: { annualKWh: 50, source: "supuesto" } }), MADRID);
    expect(sizing.panelCount).toBe(1);
  });

  it("dimensiona mas grande con bateria que sin ella", () => {
    const sin = sizeSystem(baseInput({ withBattery: false }), MADRID);
    const con = sizeSystem(baseInput({ withBattery: true }), MADRID);
    expect(con.recommendedKWp).toBeGreaterThan(sin.recommendedKWp);
  });
});

describe("estimateEnergyBalance", () => {
  it("no autoconsume mas energia de la que se gasta", () => {
    const input = baseInput({ consumption: { annualKWh: 500, source: "factura" }, maxKWp: 20 });
    const sizing = { ...sizeSystem(input, MADRID), recommendedKWp: 20, panelCount: 45 };
    const balance = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
    expect(balance.selfConsumedKWh).toBeLessThanOrEqual(input.consumption.annualKWh);
    expect(balance.selfSufficiencyRatio).toBeLessThanOrEqual(1);
  });

  it("cuadra el balance: produccion = autoconsumo + excedente", () => {
    const input = baseInput();
    const sizing = sizeSystem(input, MADRID);
    const balance = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
    expect(balance.selfConsumedKWh + balance.exportedKWh).toBeCloseTo(
      balance.annualProductionKWh,
      1,
    );
  });

  it("la bateria sube el autoconsumo sin pasar del techo fisico", () => {
    const input = baseInput();
    const sizing = sizeSystem(input, MADRID);
    const sin = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
    const con = estimateEnergyBalance(sizing, MADRID, input.consumption, true);
    expect(con.selfConsumptionRatio).toBeGreaterThan(sin.selfConsumptionRatio);
    expect(con.selfConsumptionRatio).toBeLessThanOrEqual(STUDY_DEFAULTS.maxSelfConsumptionRatio);
  });

  it("reparte la produccion en doce meses", () => {
    const input = baseInput();
    const sizing = sizeSystem(input, MADRID);
    const balance = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
    expect(balance.monthlyProductionKWh).toHaveLength(12);
    const suma = balance.monthlyProductionKWh.reduce((a, b) => a + b, 0);
    // La suma mensual debe parecerse al total anual, con holgura por redondeo.
    expect(suma).toBeGreaterThan(balance.annualProductionKWh * 0.95);
    expect(suma).toBeLessThan(balance.annualProductionKWh * 1.05);
  });
});

describe("computeEconomics", () => {
  const input = baseInput();

  it("calcula el retorno contando la degradacion de los modulos", () => {
    const sizing = sizeSystem(input, MADRID);
    const balance = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
    const eco = computeEconomics(sizing, balance, input.tariff, input.consumption, false);

    expect(eco.simplePaybackYears).not.toBeNull();
    // Con degradacion el plazo es algo mayor que la division simple.
    const ingenuo = eco.investmentEUR / eco.firstYearSavingsEUR;
    expect(eco.simplePaybackYears!).toBeGreaterThan(ingenuo);
  });

  it("devuelve null cuando la instalacion no amortiza en el horizonte", () => {
    const sizing = sizeSystem(input, MADRID);
    const balance = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
    const eco = computeEconomics(
      sizing,
      balance,
      { importPricePerKWh: 0.001, exportPricePerKWh: 0 },
      input.consumption,
      false,
    );
    expect(eco.simplePaybackYears).toBeNull();
  });

  it("la bateria encarece la inversion y alarga el retorno", () => {
    const sinSizing = sizeSystem(baseInput({ withBattery: false }), MADRID);
    const sinBalance = estimateEnergyBalance(sinSizing, MADRID, input.consumption, false);
    const sinEco = computeEconomics(sinSizing, sinBalance, input.tariff, input.consumption, false);

    const conSizing = sizeSystem(baseInput({ withBattery: true }), MADRID);
    const conBalance = estimateEnergyBalance(conSizing, MADRID, input.consumption, true);
    const conEco = computeEconomics(conSizing, conBalance, input.tariff, input.consumption, true);

    expect(conEco.investmentEUR).toBeGreaterThan(sinEco.investmentEUR);
    expect(conEco.simplePaybackYears!).toBeGreaterThan(sinEco.simplePaybackYears!);
  });
});

describe("buildStudy: trazabilidad y confianza", () => {
  it("la confianza global es la del eslabon mas debil, no la del mas fuerte", () => {
    // Radiacion de fuente oficial, pero consumo sacado de una factura.
    const study = buildStudy(baseInput({ consumption: { annualKWh: 4500, source: "factura" } }), MADRID);
    expect(study.energy.provenance.source).toBe("pvgis");
    expect(study.overallConfidence).toBe("baja");
  });

  it("sube a media cuando el consumo viene de la curva horaria", () => {
    const study = buildStudy(
      baseInput({ consumption: { annualKWh: 4500, source: "curva_horaria" } }),
      MADRID,
    );
    expect(study.overallConfidence).toBe("media");
  });

  it("pide la curva horaria mientras no la tenga", () => {
    const study = buildStudy(baseInput(), MADRID);
    expect(study.missingData.join(" ").toLowerCase()).toContain("curva de carga horaria");
  });

  it("deja de pedir la superficie cuando se le ha dado", () => {
    const sin = buildStudy(baseInput(), MADRID);
    const con = buildStudy(baseInput({ availableRoofAreaM2: 40 }), MADRID);
    expect(con.missingData.length).toBeLessThan(sin.missingData.length);
  });

  it("declara los supuestos en lugar de esconderlos", () => {
    const study = buildStudy(baseInput(), MADRID);
    expect(study.assumptions.length).toBeGreaterThanOrEqual(5);
    for (const a of study.assumptions) {
      expect(a.impact.length).toBeGreaterThan(0);
    }
  });

  it("anade el supuesto de la bateria solo cuando la hay", () => {
    const sin = buildStudy(baseInput({ withBattery: false }), MADRID);
    const con = buildStudy(baseInput({ withBattery: true }), MADRID);
    expect(sin.assumptions.some((a) => a.id === "aporte_bateria")).toBe(false);
    expect(con.assumptions.some((a) => a.id === "aporte_bateria")).toBe(true);
  });

  it("arrastra siempre el aviso de estimacion preliminar", () => {
    const study = buildStudy(baseInput(), MADRID);
    expect(study.disclaimer).toContain("preliminar");
    expect(study.disclaimer).toContain("tecnico competente");
  });

  it("es determinista: misma entrada, mismo resultado", () => {
    const a = buildStudy(baseInput(), MADRID);
    const b = buildStudy(baseInput(), MADRID);
    expect(b.sizing.value).toEqual(a.sizing.value);
    expect(b.energy.value).toEqual(a.energy.value);
    expect(b.economics.value).toEqual(a.economics.value);
  });
});

describe("parseProduction: parseo defensivo de PVGIS", () => {
  const respuestaValida = {
    inputs: {
      mounting_system: {
        fixed: { slope: { value: 37, optimal: true }, azimuth: { value: -4, optimal: true } },
      },
    },
    outputs: {
      monthly: { fixed: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_m: 100 + i })) },
      // PVGIS mezcla numeros y cadenas en el mismo bloque.
      totals: { fixed: { E_y: 1560.29, l_spec: "0.50" } },
    },
  };

  it("lee produccion, meses y geometria de una respuesta valida", () => {
    const parsed = parseProduction(respuestaValida);
    expect(parsed.specificYieldKWhPerKWp).toBe(1560.29);
    expect(parsed.monthlyPerKWp).toHaveLength(12);
    expect(parsed.tiltDeg).toBe(37);
    expect(parsed.azimuthDeg).toBe(-4);
  });

  it("acepta numeros que llegan como cadena, porque PVGIS lo hace", () => {
    const conCadena = structuredClone(respuestaValida);
    (conCadena.outputs.totals.fixed as Record<string, unknown>).E_y = "1560.29";
    expect(parseProduction(conCadena).specificYieldKWhPerKWp).toBe(1560.29);
  });

  it("rechaza una respuesta sin el bloque de salidas", () => {
    expect(() => parseProduction({ inputs: {} })).toThrow(/outputs/i);
  });

  it("rechaza un numero de meses distinto de doce", () => {
    const corta = structuredClone(respuestaValida);
    corta.outputs.monthly.fixed = corta.outputs.monthly.fixed.slice(0, 6);
    expect(() => parseProduction(corta)).toThrow(/doce meses/i);
  });

  it("rechaza un campo no numerico en lugar de propagar NaN", () => {
    const rota = structuredClone(respuestaValida);
    (rota.outputs.totals.fixed as Record<string, unknown>).E_y = "no es un numero";
    expect(() => parseProduction(rota)).toThrow(/no numerico/i);
  });

  it("tolera que falte la geometria sin reventar", () => {
    const sinGeometria = structuredClone(respuestaValida);
    delete (sinGeometria as { inputs?: unknown }).inputs;
    const parsed = parseProduction(sinGeometria);
    expect(parsed.tiltDeg).toBe(0);
  });
});
