import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { LEAD_STATES } from "../lead-states";

/**
 * Esquema de la base de datos.
 *
 * Dialecto SQLite mediante libSQL, para que el proyecto arranque con un
 * `git clone` y un `npm install`, sin levantar nada mas. En produccion esto
 * seria Postgres: la traduccion no es automatica —cambian los constructores
 * de Drizzle y los tipos de columna— pero la forma de las tablas y las
 * relaciones se mantienen tal cual.
 */

/**
 * Estados del embudo comercial. Subconjunto real del pipeline del diseño.
 * Se definen fuera para que cliente y servidor compartan la lista sin
 * arrastrar el ORM al navegador.
 */
export { LEAD_STATES, type LeadState } from "../lead-states";

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),

    /** Direccion tal y como la escribio la persona, sin normalizar. */
    rawAddress: text("raw_address").notNull(),
    /** Direccion tal y como la devolvio el geocodificador. */
    formattedAddress: text("formatted_address"),
    latitude: real("latitude"),
    longitude: real("longitude"),

    state: text("state", { enum: LEAD_STATES }).notNull().default("nuevo"),
    /** Por que se perdio o se descarto. Un estado sin motivo no sirve. */
    stateReason: text("state_reason"),

    /** Canal de entrada. Hoy solo web; el modelo ya admite mas. */
    channel: text("channel").notNull().default("web"),
    campaign: text("campaign"),

    notes: text("notes"),
  },
  (table) => [
    index("leads_state_idx").on(table.state),
    index("leads_created_idx").on(table.createdAt),
    index("leads_email_idx").on(table.email),
  ],
);

/**
 * Registro de consentimiento.
 *
 * Tabla aparte y solo-anadir: un consentimiento no se edita. Retirarlo crea
 * una fila nueva con `withdrawnAt`, de modo que el historial completo queda
 * reconstruible.
 */
export const consents = sqliteTable(
  "consents",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),

    grantedAt: integer("granted_at", { mode: "timestamp_ms" }).notNull(),
    withdrawnAt: integer("withdrawn_at", { mode: "timestamp_ms" }),

    /** Identificador de la version mostrada. */
    version: text("version").notNull(),
    /** Copia literal del texto que la persona leyo. No es redundante. */
    textShown: text("text_shown").notNull(),
    purpose: text("purpose").notNull(),
    channel: text("channel").notNull(),
  },
  (table) => [index("consents_lead_idx").on(table.leadId)],
);

/**
 * Preestudio calculado, guardado entero.
 *
 * Se conserva el resultado completo en JSON, no solo las cifras de portada:
 * procedencia, supuestos y confianza forman parte del documento. Sin ellos no
 * se puede reconstruir por que se le dijo a alguien lo que se le dijo.
 *
 * Las columnas sueltas duplican datos que ya estan dentro del JSON, a
 * proposito: son las que se ordenan y filtran en el listado del pipeline.
 */
export const studies = sqliteTable(
  "studies",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

    recommendedKWp: real("recommended_kwp").notNull(),
    annualProductionKWh: real("annual_production_kwh").notNull(),
    investmentEUR: real("investment_eur").notNull(),
    firstYearSavingsEUR: real("first_year_savings_eur").notNull(),
    paybackYears: real("payback_years"),
    confidence: text("confidence", { enum: ["alta", "media", "baja"] }).notNull(),

    /** `PreliminaryStudy` serializado. */
    payload: text("payload", { mode: "json" }).notNull(),
  },
  (table) => [index("studies_lead_idx").on(table.leadId)],
);

export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type ConsentRow = typeof consents.$inferSelect;
export type StudyRow = typeof studies.$inferSelect;
