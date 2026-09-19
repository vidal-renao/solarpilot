/**
 * Estados del embudo comercial y sus etiquetas.
 *
 * Modulo propio, sin dependencias, a proposito: lo necesitan tanto los
 * componentes de servidor como los de cliente. Vivia dentro del control de
 * cliente y el pipeline reventaba al intentar llamarlo desde el servidor,
 * porque una funcion exportada de un modulo "use client" no es invocable
 * desde alli. Tampoco puede vivir en el esquema de Drizzle: eso arrastraria
 * el ORM al paquete del navegador.
 */

export const LEAD_STATES = [
  "nuevo",
  "preestudio_disponible",
  "contactado",
  "propuesta_enviada",
  "ganado",
  "perdido",
] as const;

export type LeadState = (typeof LEAD_STATES)[number];

const LABELS: Record<LeadState, string> = {
  nuevo: "Nuevo",
  preestudio_disponible: "Preestudio listo",
  contactado: "Contactado",
  propuesta_enviada: "Propuesta enviada",
  ganado: "Ganado",
  perdido: "Perdido",
};

export function leadStateLabel(state: LeadState): string {
  return LABELS[state];
}

/** Estados terminales que exigen registrar un motivo. */
export const STATES_REQUIRING_REASON: ReadonlySet<LeadState> = new Set<LeadState>(["perdido"]);
