import type { IncentiveSummary } from "./incentives";

/**
 * Tipos del dominio del preestudio solar.
 *
 * Principio rector, heredado del prompt maestro: ningun numero viaja solo.
 * Todo dato calculado arrastra de donde sale (`Provenance`), cuanto nos
 * fiamos de el (`Confidence`) y sobre que supuestos se sostiene
 * (`Assumption`). Un preestudio sin procedencia no es revisable, y uno no
 * revisable no se puede defender ante el cliente ni ante el tecnico.
 */

/** De donde procede un dato, de mas fuerte a mas debil. */
export type SourceKind =
  /** Comision Europea. Serie de radiacion medida. */
  | "pvgis"
  /** Curva de carga horaria de la distribuidora. La mejor fuente de consumo. */
  | "curva_horaria"
  /** Factura electrica aportada por el cliente. */
  | "factura"
  /** Catalogo de producto y precios propio. */
  | "catalogo"
  /** Perfil estadistico. Estimacion, no medida. */
  | "perfil_tipo"
  /** Valor por defecto a falta de dato. La fuente mas debil. */
  | "supuesto";

export interface Provenance {
  source: SourceKind;
  /** Que fuente concreta y con que parametros. */
  detail: string;
  /** ISO 8601. Solo para fuentes externas. */
  retrievedAt?: string;
}

export type Confidence = "alta" | "media" | "baja";

/**
 * Un supuesto declarado. Si no se puede verificar, se declara aqui en lugar
 * de esconderlo en una constante.
 */
export interface Assumption {
  id: string;
  description: string;
  /** Valor adoptado, ya formateado para mostrarlo. */
  value: string;
  /** Que cambia en el resultado si el supuesto es falso. */
  impact: string;
}

/** Un valor con su trazabilidad. */
export interface Traced<T> {
  value: T;
  provenance: Provenance;
  confidence: Confidence;
}

export interface Location {
  latitude: number;
  longitude: number;
  /** Direccion normalizada tal y como la devolvio el geocodificador. */
  formattedAddress?: string;
}

/** Orientacion e inclinacion del plano de captacion. */
export interface ArrayGeometry {
  /** Grados sobre la horizontal. 0 = plano. */
  tiltDeg: number;
  /** Azimut en convencion PVGIS: 0 = sur, -90 = este, 90 = oeste. */
  azimuthDeg: number;
  /** Si true, se pide a PVGIS el angulo optimo y se ignoran tilt/azimuth. */
  useOptimalAngles: boolean;
}

export interface ConsumptionInput {
  /** kWh al ano. */
  annualKWh: number;
  /** Como hemos sabido el consumo. Condiciona la confianza del resultado. */
  source: Extract<SourceKind, "curva_horaria" | "factura" | "perfil_tipo" | "supuesto">;
}

export interface TariffInput {
  /** EUR/kWh medio de importacion, impuestos incluidos. */
  importPricePerKWh: number;
  /** EUR/kWh de compensacion de excedentes. Siempre menor que el de importacion. */
  exportPricePerKWh: number;
}

export interface StudyInput {
  location: Location;
  consumption: ConsumptionInput;
  tariff: TariffInput;
  geometry?: Partial<ArrayGeometry>;
  /**
   * Superficie **neta** utilizable para modulos, en m2.
   *
   * Neta, no bruta: ya lleva descontados obstaculos, retranqueos y zonas mal
   * orientadas. Quien conozca solo la superficie bruta del tejado debe pasar
   * por `declaredRoof`, que aplica la fraccion util. Mezclar las dos
   * semanticas en este campo infradimensiona la instalacion en silencio.
   */
  usableRoofAreaM2?: number;
  /** Tope de potencia impuesto por el cliente o por la instalacion. */
  maxKWp?: number;
  /** Incluir bateria en el dimensionado. */
  withBattery?: boolean;

  /** Particular o empresa. Solo los particulares acceden a la deduccion del IRPF. */
  isResidential?: boolean;
  /**
   * Si consta que es vivienda habitual y que habra certificados energeticos
   * antes y despues. Sin esto la deduccion se muestra como potencial, no se
   * descuenta.
   */
  meetsIrpfConditions?: boolean;
  /** Cuota anual del IBI, si el cliente la conoce. */
  annualIbiEUR?: number;
}

export interface SystemSizing {
  recommendedKWp: number;
  panelCount: number;
  panelWattsPeak: number;
  estimatedAreaM2: number;
  /** Motivo por el que el dimensionado quedo en este valor. */
  limitingFactor: "consumo" | "superficie" | "tope_potencia";
}

export interface EnergyBalance {
  annualProductionKWh: number;
  /** Produccion consumida en el sitio. */
  selfConsumedKWh: number;
  /** Produccion vertida a la red. */
  exportedKWh: number;
  /** Consumo que sigue viniendo de la red. */
  gridImportKWh: number;
  /** selfConsumed / produccion. */
  selfConsumptionRatio: number;
  /** selfConsumed / consumo. Grado de independencia. */
  selfSufficiencyRatio: number;
  monthlyProductionKWh: number[];
}

/** Una fila del cuadro de amortizacion. */
export interface CashflowYear {
  year: number;
  /** Produccion del ano, ya degradada. */
  productionKWh: number;
  savingsEUR: number;
  cumulativeEUR: number;
  /** Si en este ano el acumulado supera la inversion. */
  breakEven: boolean;
}

/**
 * Un escenario de evolucion del precio de la luz.
 *
 * El precio futuro de la energia es el supuesto que mas mueve el retorno y
 * el que nadie puede conocer. En lugar de elegir uno y presentarlo como si
 * fuese un dato, se muestran varios y se deja ver el rango.
 */
export interface SensitivityScenario {
  label: string;
  annualEscalation: number;
  paybackYears: number | null;
  lifetimeSavingsEUR: number;
}

export interface Economics {
  /** Coste de la instalacion antes de ayudas. */
  investmentEUR: number;
  /** Lo que realmente desembolsa el cliente tras los incentivos aplicables. */
  netInvestmentEUR: number;
  /** Capacidad de almacenamiento dimensionada. 0 si no lleva bateria. */
  batteryKWh: number;

  firstYearSavingsEUR: number;
  /** Parte del ahorro que viene de dejar de comprar energia. */
  selfConsumptionSavingsEUR: number;
  /** Parte que viene de compensar excedentes, ya con el tope legal aplicado. */
  compensationEUR: number;
  /**
   * Si el tope de la compensacion simplificada ha recortado el ahorro.
   *
   * El RD 244/2019 limita la compensacion al termino de energia de la
   * factura: descuenta hasta dejarlo a cero, pero nunca paga dinero. Cuando
   * esto se activa, el cliente esta regalando energia a la red.
   */
  compensationCapped: boolean;
  /** Excedente que no se puede compensar por haber alcanzado el tope. */
  uncompensatedExportKWh: number;

  /** Anos. null si no amortiza en la vida util considerada. */
  simplePaybackYears: number | null;
  /** Ahorro acumulado a 25 anos, con degradacion. */
  lifetimeSavingsEUR: number;
  /** Toneladas de CO2 evitadas al ano. */
  avoidedCO2TonnesPerYear: number;

  /** Cuadro ano a ano. */
  schedule: CashflowYear[];
  /** El retorno bajo distintas hipotesis de precio de la energia. */
  sensitivity: SensitivityScenario[];
}

export interface PreliminaryStudy {
  input: StudyInput;
  sizing: Traced<SystemSizing>;
  energy: Traced<EnergyBalance>;
  economics: Traced<Economics>;
  /** Ayudas e incentivos, separando lo aplicable de lo meramente posible. */
  incentives: IncentiveSummary;
  /** Confianza global. La del eslabon mas debil, nunca la del mas fuerte. */
  overallConfidence: Confidence;
  assumptions: Assumption[];
  /** Datos que elevarian la confianza si el cliente los aportase. */
  missingData: string[];
  /**
   * Aviso legal obligatorio. El prompt maestro lo exige y no es decorativo:
   * separa una estimacion comercial de un compromiso tecnico.
   */
  disclaimer: string;
  generatedAt: string;
}

/** La confianza global es la del eslabon mas debil. */
export function weakestConfidence(...values: Confidence[]): Confidence {
  if (values.includes("baja")) return "baja";
  if (values.includes("media")) return "media";
  return "alta";
}
