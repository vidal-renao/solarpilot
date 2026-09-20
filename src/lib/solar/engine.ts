/**
 * Motor del preestudio: dimensionado, balance energetico y economia.
 *
 * Todas las funciones son puras. La unica dependencia externa, PVGIS, entra
 * como parametro ya resuelto. Asi el calculo es determinista, testable sin
 * red y reproducible: ante la misma entrada, el mismo resultado.
 */

import {
  PRICE_TIERS_EUR_PER_KWP,
  SELF_CONSUMPTION_CURVE,
  STUDY_DEFAULTS,
  type StudyDefaults,
} from "./assumptions";
import { estimateIncentives } from "./incentives";
import type { PvgisProduction } from "./pvgis";
import {
  weakestConfidence,
  type Assumption,
  type CashflowYear,
  type SensitivityScenario,
  type Confidence,
  type ConsumptionInput,
  type Economics,
  type EnergyBalance,
  type PreliminaryStudy,
  type StudyInput,
  type SystemSizing,
  type TariffInput,
} from "./types";

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Fraccion de la produccion que se consume en el sitio, interpolada
 * linealmente sobre la curva de referencia.
 */
export function interpolateSelfConsumption(productionRatio: number): number {
  const curve = SELF_CONSUMPTION_CURVE;
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) throw new Error("Curva de autoconsumo vacia");

  if (productionRatio <= first.productionRatio) return first.selfConsumptionRatio;
  if (productionRatio >= last.productionRatio) return last.selfConsumptionRatio;

  for (let i = 0; i < curve.length - 1; i += 1) {
    const lower = curve[i];
    const upper = curve[i + 1];
    if (!lower || !upper) continue;
    if (productionRatio >= lower.productionRatio && productionRatio <= upper.productionRatio) {
      const span = upper.productionRatio - lower.productionRatio;
      if (span === 0) return lower.selfConsumptionRatio;
      const t = (productionRatio - lower.productionRatio) / span;
      return (
        lower.selfConsumptionRatio +
        t * (upper.selfConsumptionRatio - lower.selfConsumptionRatio)
      );
    }
  }
  return last.selfConsumptionRatio;
}

export function pricePerKWp(kWp: number): number {
  for (const tier of PRICE_TIERS_EUR_PER_KWP) {
    if (kWp <= tier.maxKWp) return tier.pricePerKWp;
  }
  const fallback = PRICE_TIERS_EUR_PER_KWP[PRICE_TIERS_EUR_PER_KWP.length - 1];
  if (!fallback) throw new Error("Tabla de precios vacia");
  return fallback.pricePerKWp;
}

/**
 * Dimensiona la instalacion.
 *
 * Tres topes compiten y gana el mas restrictivo: el consumo que se puede
 * aprovechar, la superficie util de cubierta y el limite que imponga el
 * cliente. El resultado se ajusta a un numero entero de paneles, porque
 * media placa no se instala.
 */
export function sizeSystem(
  input: StudyInput,
  production: PvgisProduction,
  defaults: StudyDefaults = STUDY_DEFAULTS,
): SystemSizing {
  const targetRatio = input.withBattery
    ? defaults.targetProductionRatioWithBattery
    : defaults.targetProductionRatioNoBattery;

  const kWpFromConsumption =
    (input.consumption.annualKWh * targetRatio) / production.specificYieldKWhPerKWp;

  const areaPerKWp = (1000 / defaults.panelWattsPeak) * defaults.areaPerPanelM2;

  // La superficie llega ya neta. La fraccion util se aplica en la capa de
  // cubierta, donde se sabe si el dato es bruto o medido.
  const kWpFromArea =
    input.usableRoofAreaM2 === undefined
      ? Number.POSITIVE_INFINITY
      : input.usableRoofAreaM2 / areaPerKWp;

  const kWpFromCap = input.maxKWp ?? Number.POSITIVE_INFINITY;

  const bounded = Math.min(kWpFromConsumption, kWpFromArea, kWpFromCap);

  let limitingFactor: SystemSizing["limitingFactor"] = "consumo";
  if (kWpFromArea < kWpFromConsumption && kWpFromArea <= kWpFromCap) {
    limitingFactor = "superficie";
  } else if (kWpFromCap < kWpFromConsumption && kWpFromCap < kWpFromArea) {
    limitingFactor = "tope_potencia";
  }

  // Siempre al menos un panel, y siempre un numero entero.
  const panelCount = Math.max(1, Math.round((bounded * 1000) / defaults.panelWattsPeak));
  const recommendedKWp = (panelCount * defaults.panelWattsPeak) / 1000;

  return {
    recommendedKWp: round(recommendedKWp, 2),
    panelCount,
    panelWattsPeak: defaults.panelWattsPeak,
    estimatedAreaM2: round(panelCount * defaults.areaPerPanelM2, 1),
    limitingFactor,
  };
}

export function estimateEnergyBalance(
  sizing: SystemSizing,
  production: PvgisProduction,
  consumption: ConsumptionInput,
  withBattery: boolean,
  defaults: StudyDefaults = STUDY_DEFAULTS,
): EnergyBalance {
  const annualProductionKWh = sizing.recommendedKWp * production.specificYieldKWhPerKWp;
  const productionRatio = annualProductionKWh / consumption.annualKWh;

  let selfConsumptionRatio = interpolateSelfConsumption(productionRatio);
  if (withBattery) {
    selfConsumptionRatio = Math.min(
      defaults.maxSelfConsumptionRatio,
      selfConsumptionRatio + defaults.batteryBoostSelfConsumption,
    );
  }

  // No se puede autoconsumir mas energia de la que se gasta.
  const selfConsumedKWh = Math.min(
    annualProductionKWh * selfConsumptionRatio,
    consumption.annualKWh,
  );
  const exportedKWh = Math.max(0, annualProductionKWh - selfConsumedKWh);
  const gridImportKWh = Math.max(0, consumption.annualKWh - selfConsumedKWh);

  return {
    annualProductionKWh: round(annualProductionKWh),
    selfConsumedKWh: round(selfConsumedKWh),
    exportedKWh: round(exportedKWh),
    gridImportKWh: round(gridImportKWh),
    selfConsumptionRatio: round(selfConsumedKWh / annualProductionKWh, 4),
    selfSufficiencyRatio: round(selfConsumedKWh / consumption.annualKWh, 4),
    monthlyProductionKWh: production.monthlyPerKWp.map((perKWp) =>
      round(perKWp * sizing.recommendedKWp),
    ),
  };
}

/**
 * Ahorro del primer ano, desglosado y con el tope legal aplicado.
 *
 * La compensacion simplificada del RD 244/2019 solo puede descontar hasta el
 * termino de energia de la factura. Llegado ese punto la factura de energia
 * queda a cero y el excedente restante se vierte sin retribucion: no genera
 * ingreso. Calcularlo sin tope infla el ahorro de cualquier instalacion
 * sobredimensionada, que es justo donde mas tienta hacerlo.
 */
export function computeAnnualSavings(
  balance: EnergyBalance,
  tariff: TariffInput,
): {
  selfConsumptionSavingsEUR: number;
  compensationEUR: number;
  compensationCapped: boolean;
  uncompensatedExportKWh: number;
  totalEUR: number;
} {
  const selfConsumptionSavingsEUR = balance.selfConsumedKWh * tariff.importPricePerKWh;

  const compensacionBruta = balance.exportedKWh * tariff.exportPricePerKWh;
  // Tope: lo que queda por pagar de energia comprada a la red.
  const topeLegal = balance.gridImportKWh * tariff.importPricePerKWh;

  const compensationEUR = Math.min(compensacionBruta, topeLegal);
  const compensationCapped = compensacionBruta > topeLegal + 1e-9;

  const uncompensatedExportKWh =
    compensationCapped && tariff.exportPricePerKWh > 0
      ? (compensacionBruta - topeLegal) / tariff.exportPricePerKWh
      : 0;

  return {
    selfConsumptionSavingsEUR: round(selfConsumptionSavingsEUR),
    compensationEUR: round(compensationEUR),
    compensationCapped,
    uncompensatedExportKWh: round(uncompensatedExportKWh),
    totalEUR: round(selfConsumptionSavingsEUR + compensationEUR),
  };
}

/** Proyecta el acumulado ano a ano y devuelve el plazo de recuperacion. */
function project(
  firstYearSavingsEUR: number,
  investmentEUR: number,
  escalation: number,
  defaults: StudyDefaults,
): { schedule: CashflowYear[]; paybackYears: number | null; total: number } {
  const schedule: CashflowYear[] = [];
  let cumulative = 0;
  let paybackYears: number | null = null;

  for (let year = 1; year <= defaults.analysisYears; year += 1) {
    const degradation = (1 - defaults.annualDegradationRate) ** (year - 1);
    const priceFactor = (1 + escalation) ** (year - 1);
    const yearSavings = firstYearSavingsEUR * degradation * priceFactor;
    const before = cumulative;
    cumulative += yearSavings;

    const cruzaAhora =
      paybackYears === null && cumulative >= investmentEUR && yearSavings > 0;
    if (cruzaAhora) {
      const remaining = investmentEUR - before;
      paybackYears = round(year - 1 + remaining / yearSavings, 1);
    }

    schedule.push({
      year,
      productionKWh: 0, // se rellena en computeEconomics, que conoce la produccion
      savingsEUR: round(yearSavings),
      cumulativeEUR: round(cumulative),
      breakEven: cruzaAhora,
    });
  }

  return { schedule, paybackYears, total: round(cumulative) };
}

export function computeEconomics(
  sizing: SystemSizing,
  balance: EnergyBalance,
  tariff: TariffInput,
  consumption: ConsumptionInput,
  withBattery: boolean,
  defaults: StudyDefaults = STUDY_DEFAULTS,
  /** Ayudas que reducen el desembolso. Ya filtradas: solo las aplicables. */
  appliedIncentivesEUR = 0,
): Economics {
  const modulesCost = sizing.recommendedKWp * pricePerKWp(sizing.recommendedKWp);

  const batteryKWh = withBattery
    ? (consumption.annualKWh / 365) * defaults.batteryKWhPerDailyKWh
    : 0;
  const batteryCost = batteryKWh * defaults.batteryCostPerKWh;

  const investmentEUR = modulesCost + batteryCost;
  const netInvestmentEUR = Math.max(0, investmentEUR - appliedIncentivesEUR);

  const savings = computeAnnualSavings(balance, tariff);

  // El retorno se mide sobre lo que el cliente desembolsa de verdad.
  const base = project(savings.totalEUR, netInvestmentEUR, defaults.energyPriceEscalation, defaults);

  // La produccion del cuadro sigue la misma degradacion que el ahorro.
  const schedule = base.schedule.map((fila) => ({
    ...fila,
    productionKWh: round(
      balance.annualProductionKWh * (1 - defaults.annualDegradationRate) ** (fila.year - 1),
    ),
  }));

  const sensitivity: SensitivityScenario[] = [
    { label: "Precio congelado", escalation: 0 },
    { label: "Sube un 2 % al ano", escalation: 0.02 },
    { label: "Sube un 4 % al ano", escalation: 0.04 },
  ].map(({ label, escalation }) => {
    const run = project(savings.totalEUR, netInvestmentEUR, escalation, defaults);
    return {
      label,
      annualEscalation: escalation,
      paybackYears: run.paybackYears,
      lifetimeSavingsEUR: run.total,
    };
  });

  return {
    investmentEUR: round(investmentEUR),
    netInvestmentEUR: round(netInvestmentEUR),
    batteryKWh: round(batteryKWh, 1),
    firstYearSavingsEUR: savings.totalEUR,
    selfConsumptionSavingsEUR: savings.selfConsumptionSavingsEUR,
    compensationEUR: savings.compensationEUR,
    compensationCapped: savings.compensationCapped,
    uncompensatedExportKWh: savings.uncompensatedExportKWh,
    simplePaybackYears: base.paybackYears,
    lifetimeSavingsEUR: base.total,
    avoidedCO2TonnesPerYear: round(
      (balance.annualProductionKWh * defaults.gridEmissionFactorKgPerKWh) / 1000,
      2,
    ),
    schedule,
    sensitivity,
  };
}

/** La confianza del consumo depende enteramente de como lo hemos sabido. */
function consumptionConfidence(source: ConsumptionInput["source"]): Confidence {
  switch (source) {
    case "curva_horaria":
      return "alta";
    case "factura":
      return "media";
    default:
      return "baja";
  }
}

/**
 * Ensambla el preestudio completo con su trazabilidad.
 *
 * La confianza global es la del eslabon mas debil, nunca la del mas fuerte.
 * Que la radiacion venga de una fuente oficial no arregla que el consumo sea
 * una estimacion.
 */
export function buildStudy(
  input: StudyInput,
  production: PvgisProduction,
  defaults: StudyDefaults = STUDY_DEFAULTS,
): PreliminaryStudy {
  const withBattery = input.withBattery ?? false;
  const sizing = sizeSystem(input, production, defaults);
  const balance = estimateEnergyBalance(
    sizing,
    production,
    input.consumption,
    withBattery,
    defaults,
  );
  // Los incentivos se estiman sobre la inversion bruta y despues se
  // descuentan: solo los que cumplen sus condiciones alteran el retorno.
  const grossInvestment =
    sizing.recommendedKWp * pricePerKWp(sizing.recommendedKWp) +
    (withBattery
      ? (input.consumption.annualKWh / 365) *
        defaults.batteryKWhPerDailyKWh *
        defaults.batteryCostPerKWh
      : 0);

  const incentives = estimateIncentives({
    investmentEUR: grossInvestment,
    isResidential: input.isResidential ?? true,
    meetsIrpfConditions: input.meetsIrpfConditions ?? false,
    annualIbiEUR: input.annualIbiEUR,
  });

  const economics = computeEconomics(
    sizing,
    balance,
    input.tariff,
    input.consumption,
    withBattery,
    defaults,
    incentives.appliedTotalEUR,
  );

  const consumoConf = consumptionConfidence(input.consumption.source);
  const geometryKnown = input.geometry?.useOptimalAngles === false;
  const produccionConf: Confidence = geometryKnown ? "alta" : "media";
  // Sin curva horaria, el reparto entre autoconsumo y excedente es un perfil.
  const balanceConf: Confidence =
    input.consumption.source === "curva_horaria" ? "media" : "baja";

  const assumptions: Assumption[] = [
    {
      id: "perdidas_sistema",
      description: "Perdidas totales del sistema",
      value: defaults.systemLossPercent + " %",
      impact: "Cada punto de perdida mueve la produccion anual en torno a un 1 %.",
    },
    {
      id: "curva_autoconsumo",
      description: "Reparto entre autoconsumo y excedente mediante perfil estadistico",
      value: round(balance.selfConsumptionRatio * 100, 1) + " % de la produccion",
      impact:
        "Es el supuesto que mas mueve el ahorro. La curva horaria real del suministro puede desviarlo entre diez y veinte puntos.",
    },
    {
      id: "precio_instalacion",
      description: "Precio de instalacion por kWp segun catalogo de demostracion",
      value: pricePerKWp(sizing.recommendedKWp) + " EUR/kWp",
      impact: "Un precio real desplaza el retorno de forma proporcional.",
    },
    {
      id: "escalada_precio_energia",
      description: "Escalada anual del precio de la energia",
      value: round(defaults.energyPriceEscalation * 100, 1) + " %",
      impact:
        "Se adopta cero a proposito. Cualquier escalada positiva acorta el plazo de recuperacion, de modo que el resultado es un suelo, no una expectativa.",
    },
    {
      id: "horizonte_analisis",
      description: "Horizonte de vida util considerado",
      value: defaults.analysisYears + " años",
      impact:
        "El ahorro acumulado se corta ahi. Los modulos suelen seguir produciendo despues, con menor rendimiento.",
    },
  ];

  if (withBattery) {
    assumptions.push({
      id: "aporte_bateria",
      description: "Mejora de autoconsumo atribuida a la bateria",
      value: "+" + round(defaults.batteryBoostSelfConsumption * 100, 0) + " puntos",
      impact:
        "Estimacion agregada. El aporte real depende del perfil nocturno, que solo se conoce con curva horaria.",
    });
  }

  const missingData: string[] = [];
  if (input.consumption.source !== "curva_horaria") {
    missingData.push(
      "Curva de carga horaria del punto de suministro. Es el dato que mas eleva la fiabilidad del reparto entre autoconsumo y excedente.",
    );
  }
  if (input.usableRoofAreaM2 === undefined) {
    missingData.push("Superficie util de cubierta disponible.");
  }
  if (!geometryKnown) {
    missingData.push(
      "Orientacion e inclinacion reales del tejado. El calculo usa la geometria optima teorica.",
    );
  }
  missingData.push(
    "Estado de la cubierta, sombras del entorno y situacion del cuadro electrico y la acometida.",
  );

  return {
    input,
    sizing: {
      value: sizing,
      provenance: {
        source: "catalogo",
        detail:
          "Panel de " +
          defaults.panelWattsPeak +
          " Wp, ajustado a numero entero de modulos. Factor limitante: " +
          sizing.limitingFactor +
          ".",
      },
      confidence: weakestConfidence(consumoConf, produccionConf),
    },
    energy: {
      value: balance,
      provenance: {
        source: "pvgis",
        detail:
          "PVGIS, " +
          round(production.specificYieldKWhPerKWp, 0) +
          " kWh/kWp al ano, inclinacion " +
          production.tiltDeg +
          " grados, azimut " +
          production.azimuthDeg +
          " grados.",
        retrievedAt: production.retrievedAt,
      },
      confidence: weakestConfidence(produccionConf, balanceConf),
    },
    economics: {
      value: economics,
      provenance: {
        source: "catalogo",
        detail: "Precios de catalogo de demostracion y tarifas indicadas por el usuario.",
      },
      confidence: weakestConfidence(consumoConf, balanceConf, "media"),
    },
    incentives,
    overallConfidence: weakestConfidence(consumoConf, produccionConf, balanceConf),
    assumptions,
    missingData,
    disclaimer:
      "Estimacion preliminar con fines comerciales. No constituye un proyecto tecnico ni un compromiso de produccion, ahorro o precio. La viabilidad definitiva requiere validacion por tecnico competente de cubierta, sombras, estructura, instalacion electrica y punto de conexion.",
    generatedAt: new Date().toISOString(),
  };
}
