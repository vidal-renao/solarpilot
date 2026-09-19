/**
 * Supuestos y catalogo por defecto del preestudio.
 *
 * Todo lo que aqui hay es configurable y revisable. Se agrupa en un unico
 * fichero a proposito: son los numeros que un comercial o un tecnico querra
 * ajustar sin tocar la logica, y los que hay que poder auditar cuando una
 * propuesta se cuestione.
 *
 * ATENCION: los precios son valores de demostracion para un proyecto de
 * portfolio, no una lista de precios real.
 */

export interface StudyDefaults {
  panelWattsPeak: number;
  areaPerPanelM2: number;
  usableRoofFraction: number;
  systemLossPercent: number;
  targetProductionRatioNoBattery: number;
  targetProductionRatioWithBattery: number;
  batteryBoostSelfConsumption: number;
  maxSelfConsumptionRatio: number;
  annualDegradationRate: number;
  analysisYears: number;
  energyPriceEscalation: number;
  gridEmissionFactorKgPerKWh: number;
  batteryCostPerKWh: number;
  batteryKWhPerDailyKWh: number;
}

export const STUDY_DEFAULTS: StudyDefaults = {
  /** Panel monocristalino de gama media habitual en residencial. */
  panelWattsPeak: 450,
  /** Superficie de un panel de esa potencia, aproximadamente 1,76 x 1,13 m. */
  areaPerPanelM2: 2.1,
  /**
   * Fraccion de cubierta realmente aprovechable. Descuenta chimeneas,
   * retranqueos, pasillos de mantenimiento y zonas mal orientadas.
   */
  usableRoofFraction: 0.7,
  /** Perdidas del sistema en %: cableado, inversor, suciedad, temperatura. */
  systemLossPercent: 14,
  /**
   * Sin bateria se dimensiona por debajo del consumo anual. Pasarse significa
   * verter excedentes que se compensan muy por debajo del precio de compra.
   */
  targetProductionRatioNoBattery: 0.8,
  /** Con bateria se puede aprovechar algo mas de produccion. */
  targetProductionRatioWithBattery: 1.1,
  /** Mejora absoluta del autoconsumo atribuida a la bateria. */
  batteryBoostSelfConsumption: 0.25,
  /** Techo fisico razonable del autoconsumo. Nunca es el 100 %. */
  maxSelfConsumptionRatio: 0.9,
  /** Perdida de rendimiento de los modulos por ano. */
  annualDegradationRate: 0.005,
  /** Horizonte de analisis economico. */
  analysisYears: 25,
  /**
   * Escalada del precio de la energia. Se deja en cero a proposito: es el
   * supuesto mas facil de usar para inflar un retorno y el mas dificil de
   * defender. Un retorno calculado con escalada cero es el suelo, no la
   * expectativa.
   */
  energyPriceEscalation: 0,
  /** Factor de emision del mix electrico. Valor de referencia, revisable. */
  gridEmissionFactorKgPerKWh: 0.2,
  /** Coste de almacenamiento por kWh util. */
  batteryCostPerKWh: 600,
  /** Dimensionado de bateria por kWh de consumo diario medio. */
  batteryKWhPerDailyKWh: 0.6,
};

/**
 * Precio de la instalacion por kWp, decreciente con el tamano.
 * Tramos ordenados de menor a mayor potencia.
 */
export const PRICE_TIERS_EUR_PER_KWP: ReadonlyArray<{ maxKWp: number; pricePerKWp: number }> = [
  { maxKWp: 3, pricePerKWp: 1750 },
  { maxKWp: 5, pricePerKWp: 1500 },
  { maxKWp: 10, pricePerKWp: 1300 },
  { maxKWp: 15, pricePerKWp: 1150 },
  { maxKWp: Number.POSITIVE_INFINITY, pricePerKWp: 1050 },
];

/**
 * Curva de autoconsumo para vivienda sin bateria.
 *
 * Relaciona el ratio produccion/consumo anual con la fraccion de produccion
 * que se consume en el sitio. Cuanto mas se sobredimensiona, menos se
 * aprovecha: es la razon de que dimensionar por encima del consumo rara vez
 * salga a cuenta sin almacenamiento.
 *
 * Es un perfil estadistico, no una medida. Se sustituye por el calculo real
 * en cuanto se dispone de la curva de carga horaria del punto de suministro,
 * que es la unica fuente que permite afirmar esto con rigor.
 */
export const SELF_CONSUMPTION_CURVE: ReadonlyArray<{ productionRatio: number; selfConsumptionRatio: number }> = [
  { productionRatio: 0.0, selfConsumptionRatio: 1.0 },
  { productionRatio: 0.25, selfConsumptionRatio: 0.88 },
  { productionRatio: 0.5, selfConsumptionRatio: 0.73 },
  { productionRatio: 0.75, selfConsumptionRatio: 0.61 },
  { productionRatio: 1.0, selfConsumptionRatio: 0.52 },
  { productionRatio: 1.25, selfConsumptionRatio: 0.45 },
  { productionRatio: 1.5, selfConsumptionRatio: 0.4 },
  { productionRatio: 2.0, selfConsumptionRatio: 0.32 },
  { productionRatio: 3.0, selfConsumptionRatio: 0.23 },
];
