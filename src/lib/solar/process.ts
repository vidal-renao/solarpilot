/**
 * El camino desde el preestudio hasta que la instalacion produce.
 *
 * Existe porque sin esto la aplicacion entrega un numero y se calla. Quien
 * acaba de ver que su tejado da 3.500 kWh no sabe que viene despues, cuanto
 * tarda, quien hace cada tramite ni que puede atascarse. Esa pregunta es la
 * siguiente que se hace todo el mundo, y casi ningun calculador la responde.
 *
 * Se modela como datos y no como texto en una pagina por el mismo motivo que
 * el resto del proyecto: cada paso declara quien lo ejecuta, cuanto dura, que
 * documentos exige y que puede salir mal, y hay pruebas que lo comprueban.
 * Un plazo escrito a mano en un parrafo envejece sin que nadie se entere.
 *
 * AVISO: proyecto de demostracion. Los plazos proceden de fuentes publicas
 * consultadas en septiembre de 2026 y se citan, pero varian por comunidad
 * autonoma, por potencia y sobre todo por la calidad de la documentacion.
 * No sustituyen lo que diga la administracion competente.
 */

/** Quien ejecuta el paso. Importa: la mitad no dependen de la instaladora. */
export type StepOwner =
  | "cliente"
  | "instaladora"
  | "tecnico"
  | "administracion"
  | "distribuidora"
  | "comercializadora";

export interface StepDuration {
  minDays: number;
  maxDays: number;
}

export interface ProcessStep {
  id: string;
  name: string;
  summary: string;
  owner: StepOwner;
  /** null cuando el paso es inmediato o no tiene plazo propio. */
  duration: StepDuration | null;
  /** Documentos que se generan o se exigen. */
  documents: string[];
  /** Lo que suele atascar este paso. */
  risks: string[];
  /** Condicion bajo la que el paso aplica. Ausente = siempre. */
  appliesWhen?: string;
  source?: { label: string; url: string; consultedAt: string };
}

const FUENTE_LEGALIZACION = {
  label: "Guia de legalizacion fotovoltaica para instaladores",
  url: "https://gaussol.es/blog/legalizar-una-instalacion-fotovoltaica-en-espana/",
  consultedAt: "2026-09-20",
};

const FUENTE_PLAZOS = {
  label: "Plazos de legalizacion ante Industria",
  url: "https://sotysolar.es/blog/cuanto-tarda-industria-en-legalizar-paneles-solares",
  consultedAt: "2026-09-20",
};

export const PROCESS_STEPS: ProcessStep[] = [
  {
    id: "preestudio",
    name: "Preestudio",
    summary:
      "Lo que acabas de hacer. Dimensionado orientativo a partir de la radiacion medida de tu ubicacion y de tu consumo. No compromete a nada.",
    owner: "instaladora",
    duration: { minDays: 0, maxDays: 1 },
    documents: ["Preestudio con supuestos y nivel de confianza"],
    risks: [
      "Se apoya en la geometria optima teorica del tejado, no en la real.",
      "Si el consumo viene de una factura y no de la curva horaria, el reparto entre autoconsumo y excedente es un perfil estadistico.",
    ],
  },
  {
    id: "visita",
    name: "Visita tecnica",
    summary:
      "Un tecnico mide la cubierta, evalua sombras, estructura, cuadro electrico y punto de conexion. Es donde el preestudio se convierte en un numero defendible o se cae.",
    owner: "tecnico",
    duration: { minDays: 3, maxDays: 15 },
    documents: ["Informe de viabilidad tecnica"],
    risks: [
      "Cubierta de fibrocemento o amianto: exige retirada por empresa autorizada y cambia el presupuesto por completo.",
      "Sombras de edificaciones o arbolado que no se ven en un mapa.",
      "Cuadro electrico o acometida que no admiten la potencia prevista.",
    ],
  },
  {
    id: "propuesta",
    name: "Propuesta en firme",
    summary:
      "Con los datos de la visita, el presupuesto deja de ser estimacion. Incluye componentes concretos, precio cerrado, plazos y exclusiones.",
    owner: "instaladora",
    duration: { minDays: 2, maxDays: 7 },
    documents: ["Presupuesto con periodo de validez", "Contrato"],
    risks: [
      "Los precios de modulos e inversores se mueven: una propuesta sin fecha de caducidad es un compromiso abierto.",
      "En venta a consumidor fuera de establecimiento existe derecho de desistimiento; conviene saber desde cuando cuenta.",
    ],
  },
  {
    id: "proyecto",
    name: "Memoria tecnica o proyecto",
    summary:
      "Documentacion tecnica que exige la administracion. Hasta 10 kW basta memoria tecnica de diseno; por encima hace falta proyecto y certificado de direccion de obra.",
    owner: "tecnico",
    duration: { minDays: 3, maxDays: 10 },
    documents: ["Memoria tecnica de diseno o proyecto", "Esquema unifilar"],
    risks: ["Documentacion incompleta desde el inicio es la causa mas comun de retraso en todo el proceso."],
    source: FUENTE_LEGALIZACION,
  },
  {
    id: "licencia",
    name: "Tramite municipal",
    summary:
      "Licencia de obra o declaracion responsable ante el ayuntamiento, segun el municipio. Es tambien el momento de solicitar las bonificaciones de IBI e ICIO si la ordenanza las contempla.",
    owner: "administracion",
    duration: { minDays: 7, maxDays: 30 },
    documents: ["Declaracion responsable o licencia", "Solicitud de bonificaciones"],
    risks: [
      "Cada ayuntamiento tiene su ordenanza: el plazo y los requisitos cambian de un municipio al de al lado.",
      "Las bonificaciones suelen solicitarse, no concederse de oficio.",
    ],
  },
  {
    id: "instalacion",
    name: "Instalacion",
    summary:
      "El montaje en si. En residencial suele resolverse en uno o dos dias; en cubierta industrial depende de la superficie y de los medios de elevacion.",
    owner: "instaladora",
    duration: { minDays: 1, maxDays: 5 },
    documents: ["Albaran de equipos", "Garantias de fabricante"],
    risks: ["Disponibilidad de material: un inversor concreto puede tener semanas de plazo."],
  },
  {
    id: "cie",
    name: "Certificado de instalacion electrica",
    summary:
      "El instalador autorizado emite el CIE, que acredita que la instalacion cumple el reglamento electrotecnico de baja tension.",
    owner: "instaladora",
    duration: { minDays: 3, maxDays: 7 },
    documents: ["CIE"],
    risks: ["Fabricantes e instaladores condicionan sus garantias al cumplimiento del REBT y a la correcta legalizacion."],
    source: FUENTE_PLAZOS,
  },
  {
    id: "registro",
    name: "Registro ante la comunidad autonoma",
    summary:
      "Presentacion telematica del CIE, la memoria y la documentacion de equipos ante el organo de Industria, y alta en el registro de autoconsumo.",
    owner: "administracion",
    duration: { minDays: 7, maxDays: 15 },
    documents: ["Inscripcion en el registro de autoconsumo"],
    risks: ["El plazo depende de la comunidad autonoma y de que la documentacion llegue completa."],
    source: FUENTE_PLAZOS,
  },
  {
    id: "conexion",
    name: "Punto de conexion y codigo CAU",
    summary:
      "Solicitud a la distribuidora del punto de conexion y obtencion del codigo de autoconsumo. Solo aplica si se vierten excedentes a la red.",
    owner: "distribuidora",
    duration: { minDays: 15, maxDays: 60 },
    documents: ["Codigo CAU"],
    risks: [
      "Es el paso mas lento y el que menos controla la instaladora: puede irse a dos meses.",
      "Un error en el CUPS o en la titularidad del suministro lo bloquea de inicio.",
    ],
    appliesWhen: "Solo en autoconsumo con excedentes",
    source: FUENTE_LEGALIZACION,
  },
  {
    id: "compensacion",
    name: "Contrato de compensacion",
    summary:
      "Acuerdo con la comercializadora para que los excedentes vertidos descuenten en la factura. Sin el, la energia sobrante se regala a la red.",
    owner: "comercializadora",
    duration: { minDays: 5, maxDays: 10 },
    documents: ["Contrato de compensacion de excedentes"],
    risks: [
      "El precio del excedente lo fija cada comercializadora y varia bastante entre unas y otras.",
      "La compensacion nunca genera un cobro: solo descuenta hasta dejar a cero el termino de energia.",
    ],
    appliesWhen: "Solo en autoconsumo con excedentes",
    source: FUENTE_LEGALIZACION,
  },
  {
    id: "puesta_en_marcha",
    name: "Puesta en marcha",
    summary:
      "La instalacion produce y la factura empieza a bajar. A partir de aqui queda la monitorizacion y el mantenimiento.",
    owner: "cliente",
    duration: null,
    documents: ["Manual y acceso a la monitorizacion"],
    risks: ["Conviene revisar la primera factura: es donde se ve si la compensacion esta bien aplicada."],
  },
];

/**
 * Expresa un plazo en la unidad que no lo deforma.
 *
 * Redondear siempre a semanas produce disparates: 5 a 10 dias se convierte en
 * "1 a 1 semanas", que no informa de nada, y 3 a 15 dias en "0 a 2 semanas",
 * que directamente miente —ningun tramite dura cero—. Los plazos cortos se
 * dicen en dias, y los largos en semanas redondeando hacia arriba, porque
 * quedarse corto en una estimacion de plazo es la unica direccion en la que
 * el error se nota.
 */
export function formatDuration(duration: StepDuration | null): string {
  if (!duration) return "—";
  const { minDays, maxDays } = duration;

  if (maxDays <= 10) {
    return minDays === maxDays ? `${maxDays} días` : `${minDays}–${maxDays} días`;
  }

  const minWeeks = Math.max(1, Math.floor(minDays / 7));
  const maxWeeks = Math.ceil(maxDays / 7);
  return minWeeks === maxWeeks ? `${maxWeeks} semanas` : `${minWeeks}–${maxWeeks} semanas`;
}

export const OWNER_LABELS: Record<StepOwner, string> = {
  cliente: "Tú",
  instaladora: "La instaladora",
  tecnico: "Técnico competente",
  administracion: "Administración",
  distribuidora: "Distribuidora",
  comercializadora: "Comercializadora",
};

export interface ProcessTotals {
  minDays: number;
  maxDays: number;
  /** Dias que no dependen de la instaladora ni del cliente. */
  outOfControlMaxDays: number;
}

/**
 * Suma los plazos del recorrido.
 *
 * Los pasos condicionales se incluyen o no segun haya excedentes. Se calcula
 * ademas cuanto del plazo maximo esta en manos de terceros, que es el dato
 * que evita la promesa de "en dos semanas lo tienes".
 */
export function totalDuration(withSurplus = true): ProcessTotals {
  const pasos = PROCESS_STEPS.filter((s) => withSurplus || !s.appliesWhen);

  let minDays = 0;
  let maxDays = 0;
  let outOfControlMaxDays = 0;

  for (const paso of pasos) {
    if (!paso.duration) continue;
    minDays += paso.duration.minDays;
    maxDays += paso.duration.maxDays;
    if (paso.owner === "administracion" || paso.owner === "distribuidora" || paso.owner === "comercializadora") {
      outOfControlMaxDays += paso.duration.maxDays;
    }
  }

  return { minDays, maxDays, outOfControlMaxDays };
}

/** Los pasos que aplican a un caso concreto. */
export function stepsFor(withSurplus = true): ProcessStep[] {
  return PROCESS_STEPS.filter((s) => withSurplus || !s.appliesWhen);
}
