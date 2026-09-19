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
  /** Superficie de cubierta disponible en m2, si se conoce. */
  availableRoofAreaM2?: number;
  /** Tope de potencia impuesto por el cliente o por la instalacion. */
  maxKWp?: number;
  /** Incluir bateria en el dimensionado. */
  withBattery?: boolean;
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

export interface Economics {
  investmentEUR: number;
  firstYearSavingsEUR: number;
  /** Anos. null si no amortiza en la vida util considerada. */
  simplePaybackYears: number | null;
  /** Ahorro acumulado a 25 anos, con degradacion. */
  lifetimeSavingsEUR: number;
  /** Toneladas de CO2 evitadas al ano. */
  avoidedCO2TonnesPerYear: number;
}

export interface PreliminaryStudy {
  input: StudyInput;
  sizing: Traced<SystemSizing>;
  energy: Traced<EnergyBalance>;
  economics: Traced<Economics>;
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
