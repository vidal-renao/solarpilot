import type { PreliminaryStudy } from "./types";

/**
 * Comparacion entre escenarios.
 *
 * La pregunta que se hace todo el mundo delante de un preestudio no es
 * "cuanto ahorro", sino "me compensa la bateria". Obligar a marcar una
 * casilla, recalcular y recordar de memoria las cifras anteriores es pedirle
 * al cliente que haga la comparacion mental que deberia hacer la aplicacion.
 *
 * Se resume en vez de devolver los dos preestudios enteros: el cuadro de
 * amortizacion son veinticinco filas, y duplicarlo para una tabla de seis
 * lineas es enviar veinte veces mas de lo que se pinta.
 */
export interface ScenarioSummary {
  withBattery: boolean;
  recommendedKWp: number;
  panelCount: number;
  batteryKWh: number;
  investmentEUR: number;
  netInvestmentEUR: number;
  firstYearSavingsEUR: number;
  /** Fraccion de la produccion que se aprovecha en el sitio. */
  selfConsumptionRatio: number;
  /** Fraccion del consumo que cubre la instalacion. */
  selfSufficiencyRatio: number;
  paybackYears: number | null;
  lifetimeSavingsEUR: number;
  /** Si el tope legal de compensacion recorta el ahorro en este escenario. */
  compensationCapped: boolean;
}

export function summarise(study: PreliminaryStudy): ScenarioSummary {
  const s = study.sizing.value;
  const e = study.energy.value;
  const ec = study.economics.value;

  return {
    withBattery: study.input.withBattery ?? false,
    recommendedKWp: s.recommendedKWp,
    panelCount: s.panelCount,
    batteryKWh: ec.batteryKWh,
    investmentEUR: ec.investmentEUR,
    netInvestmentEUR: ec.netInvestmentEUR,
    firstYearSavingsEUR: ec.firstYearSavingsEUR,
    selfConsumptionRatio: e.selfConsumptionRatio,
    selfSufficiencyRatio: e.selfSufficiencyRatio,
    paybackYears: ec.simplePaybackYears,
    lifetimeSavingsEUR: ec.lifetimeSavingsEUR,
    compensationCapped: ec.compensationCapped,
  };
}

export interface ScenarioVerdict {
  /** Cuanto mas cuesta el escenario con bateria, en euros netos. */
  extraCostEUR: number;
  /** Cuantos puntos porcentuales gana de autosuficiencia. */
  extraSelfSufficiencyPoints: number;
  /** Diferencia de plazo de recuperacion, en anos. Positivo = tarda mas. */
  paybackDeltaYears: number | null;
  /** Diferencia de ahorro acumulado a 25 anos. */
  lifetimeDeltaEUR: number;
  /**
   * Si a 25 anos la bateria devuelve mas de lo que cuesta.
   *
   * No es una recomendacion: alguien puede querer bateria por respaldo ante
   * cortes aunque no salga a cuenta. Es un dato para decidir, no la decision.
   */
  paysForItself: boolean;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Compara los dos escenarios y expresa la diferencia en terminos utiles. */
export function compareScenarios(
  sinBateria: ScenarioSummary,
  conBateria: ScenarioSummary,
): ScenarioVerdict {
  const extraCostEUR = round(conBateria.netInvestmentEUR - sinBateria.netInvestmentEUR);
  const lifetimeDeltaEUR = round(conBateria.lifetimeSavingsEUR - sinBateria.lifetimeSavingsEUR);

  return {
    extraCostEUR,
    extraSelfSufficiencyPoints: round(
      (conBateria.selfSufficiencyRatio - sinBateria.selfSufficiencyRatio) * 100,
      1,
    ),
    paybackDeltaYears:
      conBateria.paybackYears !== null && sinBateria.paybackYears !== null
        ? round(conBateria.paybackYears - sinBateria.paybackYears, 1)
        : null,
    lifetimeDeltaEUR,
    paysForItself: lifetimeDeltaEUR > extraCostEUR,
  };
}
