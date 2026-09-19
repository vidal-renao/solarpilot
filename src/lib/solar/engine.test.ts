import { describe, expect, it } from "vitest";

import { STUDY_DEFAULTS } from "./assumptions";
import {
  buildStudy,
  computeAnnualSavings,
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
    // La superficie entra ya neta: el descuento de la fraccion util es
    // responsabilidad de la capa de cubierta, no del motor.
    const sizing = sizeSystem(baseInput({ usableRoofAreaM2: 8 }), MADRID);
    expect(sizing.limitingFactor).toBe("superficie");
    // 8 m2 netos / 4,667 m2 por kWp = 1,71 kWp -> 4 modulos
    expect(sizing.panelCount).toBe(4);
  });

  it("no vuelve a descontar la fraccion util sobre una superficie ya neta", () => {
    // Blindaje contra la regresion que motivo separar bruto de neto: si el
    // motor aplicase otra vez el 0,7, cabrian menos modulos de los que caben.
    // La superficie ha de ser pequena para que la cubierta sea lo que limita;
    // con una cubierta holgada manda el consumo y la prueba no mediria nada.
    const areaPerKWp = (1000 / STUDY_DEFAULTS.panelWattsPeak) * STUDY_DEFAULTS.areaPerPanelM2;
    const neta = 8;
    const sizing = sizeSystem(baseInput({ usableRoofAreaM2: neta }), MADRID);
    expect(sizing.limitingFactor).toBe("superficie");

    const conDobleDescuento = Math.round(
      (((neta * STUDY_DEFAULTS.usableRoofFraction) / areaPerKWp) * 1000) /
        STUDY_DEFAULTS.panelWattsPeak,
    );
    expect(sizing.panelCount).toBeGreaterThan(conDobleDescuento);
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
    const con = buildStudy(baseInput({ usableRoofAreaM2: 40 }), MADRID);
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

describe("computeAnnualSavings: tope de la compensacion simplificada", () => {
  const balance = (selfConsumed: number, exported: number, gridImport: number) => ({
    annualProductionKWh: selfConsumed + exported,
    selfConsumedKWh: selfConsumed,
    exportedKWh: exported,
    gridImportKWh: gridImport,
    selfConsumptionRatio: 0,
    selfSufficiencyRatio: 0,
    monthlyProductionKWh: [],
  });

  const tarifa = { importPricePerKWh: 0.22, exportPricePerKWh: 0.06 };

  it("compensa sin recorte cuando queda factura de energia que descontar", () => {
    // Excedente 1.000 x 0,06 = 60 EUR. Energia de red 2.000 x 0,22 = 440 EUR.
    const r = computeAnnualSavings(balance(2000, 1000, 2000), tarifa);
    expect(r.compensationEUR).toBeCloseTo(60);
    expect(r.compensationCapped).toBe(false);
    expect(r.uncompensatedExportKWh).toBe(0);
  });

  it("recorta la compensacion al termino de energia y nunca paga dinero", () => {
    // Excedente 10.000 x 0,06 = 600 EUR, pero solo se compran 100 kWh de red:
    // el tope son 22 EUR. El resto se vierte sin retribucion.
    const r = computeAnnualSavings(balance(500, 10_000, 100), tarifa);
    expect(r.compensationEUR).toBeCloseTo(22);
    expect(r.compensationCapped).toBe(true);
    expect(r.uncompensatedExportKWh).toBeGreaterThan(9000);
  });

  it("no compensa nada cuando no se compra energia a la red", () => {
    const r = computeAnnualSavings(balance(4000, 5000, 0), tarifa);
    expect(r.compensationEUR).toBe(0);
    expect(r.compensationCapped).toBe(true);
  });

  it("el ahorro total es la suma de los dos conceptos", () => {
    const r = computeAnnualSavings(balance(2000, 1000, 2000), tarifa);
    expect(r.totalEUR).toBeCloseTo(r.selfConsumptionSavingsEUR + r.compensationEUR, 2);
  });

  it("sobredimensionar deja de mejorar el ahorro una vez alcanzado el tope", () => {
    const moderado = computeAnnualSavings(balance(2000, 2000, 2000), tarifa);
    const excesivo = computeAnnualSavings(balance(2000, 40_000, 2000), tarifa);
    // Mismo autoconsumo, veinte veces mas excedente, y el ahorro no se dispara.
    expect(excesivo.totalEUR).toBeLessThan(moderado.totalEUR * 2);
    expect(excesivo.compensationCapped).toBe(true);
  });
});

describe("computeEconomics: cuadro y sensibilidad", () => {
  const input = baseInput();
  const sizing = sizeSystem(input, MADRID);
  const balance = estimateEnergyBalance(sizing, MADRID, input.consumption, false);
  const eco = computeEconomics(sizing, balance, input.tariff, input.consumption, false);

  it("proyecta un cuadro con una fila por ano del horizonte", () => {
    expect(eco.schedule).toHaveLength(STUDY_DEFAULTS.analysisYears);
    expect(eco.schedule[0]?.year).toBe(1);
  });

  it("el acumulado no decrece nunca", () => {
    for (let i = 1; i < eco.schedule.length; i += 1) {
      expect(eco.schedule[i]!.cumulativeEUR).toBeGreaterThanOrEqual(
        eco.schedule[i - 1]!.cumulativeEUR,
      );
    }
  });

  it("la produccion del cuadro decrece por la degradacion de los modulos", () => {
    const primero = eco.schedule[0]!.productionKWh;
    const ultimo = eco.schedule[eco.schedule.length - 1]!.productionKWh;
    expect(ultimo).toBeLessThan(primero);
  });

  it("marca el ano de recuperacion una sola vez", () => {
    expect(eco.schedule.filter((f) => f.breakEven)).toHaveLength(1);
  });

  it("ofrece varios escenarios de precio y el mas alto amortiza antes", () => {
    expect(eco.sensitivity.length).toBeGreaterThanOrEqual(3);
    const congelado = eco.sensitivity[0]!;
    const alcista = eco.sensitivity[eco.sensitivity.length - 1]!;
    expect(alcista.annualEscalation).toBeGreaterThan(congelado.annualEscalation);
    expect(alcista.paybackYears!).toBeLessThan(congelado.paybackYears!);
    expect(alcista.lifetimeSavingsEUR).toBeGreaterThan(congelado.lifetimeSavingsEUR);
  });

  it("las ayudas aplicables reducen el desembolso y acortan el retorno", () => {
    const sinAyudas = computeEconomics(sizing, balance, input.tariff, input.consumption, false);
    const conAyudas = computeEconomics(
      sizing, balance, input.tariff, input.consumption, false, STUDY_DEFAULTS, 1500,
    );
    expect(conAyudas.netInvestmentEUR).toBeCloseTo(sinAyudas.investmentEUR - 1500, 1);
    expect(conAyudas.simplePaybackYears!).toBeLessThan(sinAyudas.simplePaybackYears!);
    // La inversion bruta no se toca: es lo que cuesta la instalacion.
    expect(conAyudas.investmentEUR).toBeCloseTo(sinAyudas.investmentEUR, 2);
  });

  it("una ayuda mayor que la inversion no genera desembolso negativo", () => {
    const eco = computeEconomics(
      sizing, balance, input.tariff, input.consumption, false, STUDY_DEFAULTS, 99_999,
    );
    expect(eco.netInvestmentEUR).toBe(0);
  });
});
