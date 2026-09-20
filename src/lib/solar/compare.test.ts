import { describe, expect, it } from "vitest";

import { STUDY_DEFAULTS } from "./assumptions";
import { compareScenarios, summarise } from "./compare";
import { buildStudy } from "./engine";
import type { PvgisProduction } from "./pvgis";
import type { StudyInput } from "./types";

const MADRID: PvgisProduction = {
  specificYieldKWhPerKWp: 1560.29,
  monthlyPerKWp: [103, 112, 148, 148, 153, 157, 168, 168, 147, 126, 103, 97],
  tiltDeg: 37,
  azimuthDeg: -4,
  retrievedAt: "2026-09-20T10:00:00.000Z",
};

const entrada = (withBattery: boolean): StudyInput => ({
  location: { latitude: 40.4167, longitude: -3.7035 },
  consumption: { annualKWh: 5200, source: "factura" },
  tariff: { importPricePerKWh: 0.22, exportPricePerKWh: 0.06 },
  geometry: { tiltDeg: 30, azimuthDeg: 0, useOptimalAngles: true },
  withBattery,
});

const sin = summarise(buildStudy(entrada(false), MADRID));
const con = summarise(buildStudy(entrada(true), MADRID));

describe("summarise", () => {
  it("refleja si el escenario lleva bateria", () => {
    expect(sin.withBattery).toBe(false);
    expect(con.withBattery).toBe(true);
  });

  it("solo el escenario con bateria declara capacidad", () => {
    expect(sin.batteryKWh).toBe(0);
    expect(con.batteryKWh).toBeGreaterThan(0);
  });

  it("dimensiona la bateria en proporcion al consumo diario", () => {
    const diario = 5200 / 365;
    expect(con.batteryKWh).toBeCloseTo(diario * STUDY_DEFAULTS.batteryKWhPerDailyKWh, 0);
  });
});

describe("compareScenarios", () => {
  const veredicto = compareScenarios(sin, con);

  it("la bateria cuesta mas", () => {
    expect(veredicto.extraCostEUR).toBeGreaterThan(0);
  });

  it("y a cambio cubre mas consumo", () => {
    expect(veredicto.extraSelfSufficiencyPoints).toBeGreaterThan(0);
  });

  it("alarga el plazo de recuperacion", () => {
    // Con los precios de catalogo actuales la bateria no se paga sola, que es
    // el resultado honesto y el que casi nadie ensena.
    expect(veredicto.paybackDeltaYears).not.toBeNull();
    expect(veredicto.paybackDeltaYears!).toBeGreaterThan(0);
  });

  it("dice si se paga sola comparando sobrecoste y ahorro extra", () => {
    const esperado = veredicto.lifetimeDeltaEUR > veredicto.extraCostEUR;
    expect(veredicto.paysForItself).toBe(esperado);
  });

  it("las diferencias cuadran con los dos resumenes", () => {
    expect(veredicto.extraCostEUR).toBeCloseTo(sin.netInvestmentEUR * -1 + con.netInvestmentEUR, 1);
    expect(veredicto.lifetimeDeltaEUR).toBeCloseTo(
      con.lifetimeSavingsEUR - sin.lifetimeSavingsEUR,
      1,
    );
  });

  it("no revienta cuando un escenario no amortiza", () => {
    const sinRetorno = { ...sin, paybackYears: null };
    expect(compareScenarios(sinRetorno, con).paybackDeltaYears).toBeNull();
  });
});
