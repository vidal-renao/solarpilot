/**
 * Incentivos fiscales aplicables a una instalacion de autoconsumo.
 *
 * Es la pieza que mas mueve el retorno y la que casi ningun calculador
 * modela bien: o los ignora, o los da por concedidos. Ninguna de las dos
 * cosas es defendible.
 *
 * El criterio aqui es el mismo que rige todo el proyecto: se muestra lo que
 * se puede justificar, se declara el ambito territorial de cada ayuda, y lo
 * que depende de una ordenanza municipal que no se ha verificado se marca
 * como potencial en lugar de sumarlo al ahorro.
 *
 * AVISO: proyecto de demostracion. Los porcentajes y limites proceden de
 * fuentes publicas consultadas en septiembre de 2026 y se citan, pero no
 * sustituyen el asesoramiento de un profesional fiscal ni la consulta de la
 * ordenanza vigente en el municipio.
 */

export type IncentiveScope = "estatal" | "autonomico" | "municipal";

/** Si se puede sumar al calculo o solo mostrarse como posibilidad. */
export type IncentiveStatus =
  /** Regla verificada y aplicable con los datos disponibles. */
  | "aplicable"
  /** Existe en muchos municipios, pero no se ha validado el del cliente. */
  | "potencial"
  /** Requiere un dato o un tramite que aun no consta. */
  | "condicionado";

export interface IncentiveProgram {
  id: string;
  name: string;
  scope: IncentiveScope;
  status: IncentiveStatus;
  /** Que reduce: la inversion inicial o un impuesto recurrente. */
  kind: "inversion" | "impuesto_recurrente";
  description: string;
  /** Condiciones que el cliente debe cumplir. Se muestran siempre. */
  requirements: string[];
  source: { label: string; url: string; consultedAt: string };
  /** Fecha limite conocida, si la hay. */
  deadline?: string;
}

export interface IncentiveEstimate {
  program: IncentiveProgram;
  /** Importe estimado en euros. Para impuestos recurrentes, el total del periodo. */
  amountEUR: number;
  /** Como se ha llegado a esa cifra. */
  basis: string;
}

export interface IncentiveSummary {
  /** Ayudas que se descuentan de la inversion en el calculo economico. */
  applied: IncentiveEstimate[];
  /** Ayudas plausibles que NO se descuentan por no estar verificadas. */
  potential: IncentiveEstimate[];
  /** Suma de lo aplicado. */
  appliedTotalEUR: number;
  /** Suma de lo potencial. El techo de lo que podria mejorar. */
  potentialTotalEUR: number;
}

/* ------------------------------------------------------------------ */

const IRPF_RATE = 0.4;
const IRPF_MAX_BASE = 7500;

/** Rango habitual de bonificacion del IBI en las ordenanzas municipales. */
const IBI_TYPICAL_RATE = { min: 0.3, max: 0.5 };
const IBI_TYPICAL_YEARS = 3;
/** Rango habitual de bonificacion del ICIO. */
const ICIO_TYPICAL_RATE = { min: 0.5, max: 0.95 };

export const PROGRAMS: Record<string, IncentiveProgram> = {
  irpf_40: {
    id: "irpf_40",
    name: "Deduccion en el IRPF por mejora de la eficiencia energetica",
    scope: "estatal",
    status: "condicionado",
    kind: "inversion",
    description:
      "Deduccion del 40 % de lo invertido, sobre una base maxima de 7.500 EUR, para obras que reduzcan el consumo de energia primaria no renovable de la vivienda.",
    requirements: [
      "Vivienda habitual, o arrendada o en expectativa de alquiler.",
      "Certificado de eficiencia energetica anterior y posterior a la obra, emitido por tecnico competente.",
      "Pago por transferencia, tarjeta o ingreso en cuenta. En efectivo no da derecho a deduccion.",
      "Instalacion ejecutada por empresa autorizada.",
    ],
    source: {
      label: "Agencia Tributaria — Deducciones por eficiencia energetica",
      url: "https://sede.agenciatributaria.gob.es/Sede/irpf/campana-renta/deducciones-eficiencia-energetica.html",
      consultedAt: "2026-09-19",
    },
    deadline: "31 de diciembre de 2026",
  },

  ibi: {
    id: "ibi",
    name: "Bonificacion del IBI",
    scope: "municipal",
    status: "potencial",
    kind: "impuesto_recurrente",
    description:
      "Muchos ayuntamientos bonifican parte de la cuota del IBI durante varios anos a quien instala autoconsumo. El porcentaje, la duracion y los requisitos los fija cada ordenanza.",
    requirements: [
      "Depende de la ordenanza fiscal del municipio: puede no existir.",
      "Suele exigir que la instalacion no sea obligatoria por normativa.",
      "Habitualmente hay que solicitarla, y no se concede de oficio.",
    ],
    source: {
      label: "Guias sectoriales sobre bonificaciones municipales",
      url: "https://sotysolar.es/placas-solares/subvenciones",
      consultedAt: "2026-09-19",
    },
  },

  icio: {
    id: "icio",
    name: "Bonificacion del ICIO",
    scope: "municipal",
    status: "potencial",
    kind: "inversion",
    description:
      "Bonificacion sobre el Impuesto de Construcciones, Instalaciones y Obras de la licencia. Tambien la fija cada ayuntamiento.",
    requirements: [
      "Depende de la ordenanza fiscal del municipio.",
      "Se aplica sobre la cuota del ICIO, no sobre el coste de la instalacion.",
    ],
    source: {
      label: "Guias sectoriales sobre bonificaciones municipales",
      url: "https://sotysolar.es/placas-solares/subvenciones",
      consultedAt: "2026-09-19",
    },
  },
};

export interface IncentiveInput {
  investmentEUR: number;
  /** Solo los particulares acceden a la deduccion del IRPF. */
  isResidential: boolean;
  /** Si consta que es vivienda habitual y habra certificados. */
  meetsIrpfConditions: boolean;
  /** Cuota anual del IBI, si el cliente la aporta. */
  annualIbiEUR?: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Estima los incentivos separando lo que se puede aplicar de lo que no.
 *
 * Nada entra en `applied` sin que se cumplan sus condiciones. Todo lo demas
 * va a `potential`, que se muestra al cliente como margen de mejora y nunca
 * se suma al ahorro ni acorta el retorno.
 */
export function estimateIncentives(input: IncentiveInput): IncentiveSummary {
  const applied: IncentiveEstimate[] = [];
  const potential: IncentiveEstimate[] = [];

  const irpf = PROGRAMS.irpf_40;
  if (irpf && input.isResidential) {
    const base = Math.min(input.investmentEUR, IRPF_MAX_BASE);
    const amount = round(base * IRPF_RATE);
    const estimate: IncentiveEstimate = {
      program: irpf,
      amountEUR: amount,
      basis:
        `${IRPF_RATE * 100} % sobre ${round(base)} EUR` +
        (input.investmentEUR > IRPF_MAX_BASE
          ? `, base limitada al maximo de ${IRPF_MAX_BASE} EUR`
          : ""),
    };
    if (input.meetsIrpfConditions) applied.push(estimate);
    else potential.push(estimate);
  }

  const ibi = PROGRAMS.ibi;
  if (ibi && input.annualIbiEUR && input.annualIbiEUR > 0) {
    const media = (IBI_TYPICAL_RATE.min + IBI_TYPICAL_RATE.max) / 2;
    potential.push({
      program: ibi,
      amountEUR: round(input.annualIbiEUR * media * IBI_TYPICAL_YEARS),
      basis: `${Math.round(media * 100)} % de ${input.annualIbiEUR} EUR al ano durante ${IBI_TYPICAL_YEARS} anos, valores tipicos`,
    });
  }

  const icio = PROGRAMS.icio;
  if (icio) {
    // El ICIO ronda el 4 % del presupuesto de ejecucion segun el municipio.
    const cuotaEstimada = input.investmentEUR * 0.04;
    const media = (ICIO_TYPICAL_RATE.min + ICIO_TYPICAL_RATE.max) / 2;
    potential.push({
      program: icio,
      amountEUR: round(cuotaEstimada * media),
      basis: `${Math.round(media * 100)} % sobre una cuota estimada de ${round(cuotaEstimada)} EUR, valores tipicos`,
    });
  }

  return {
    applied,
    potential,
    appliedTotalEUR: round(applied.reduce((sum, e) => sum + e.amountEUR, 0)),
    potentialTotalEUR: round(potential.reduce((sum, e) => sum + e.amountEUR, 0)),
  };
}
