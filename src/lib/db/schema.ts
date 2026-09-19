import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { LEAD_STATES } from "../lead-states";

/**
 * Esquema de la base de datos. Postgres.
 *
 * Las tablas van prefijadas con `solar_` porque esta base puede compartirse
 * con otras aplicaciones del mismo ecosistema. Nombres tan genericos como
 * `leads` o `consents` colisionarian tarde o temprano.
 *
 * Todas llevan RLS activado y ninguna politica. En Supabase eso no es un
 * detalle: el proyecto publica una API REST con clave anonima sobre las
 * tablas, y `solar_leads` guarda nombres, correos y direcciones. Sin RLS
 * serian legibles por cualquiera que tenga la clave publicable.
 *
 * La aplicacion no se ve afectada porque conecta por Postgres directo con el
 * rol propietario de las tablas, que no esta sujeto a RLS. El dia que algo
 * deba leerse desde el navegador habra que escribir politicas explicitas.
 */

export { LEAD_STATES, type LeadState } from "../lead-states";

export const leads = pgTable(
  "solar_leads",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),

    /** Direccion tal y como la escribio la persona, sin normalizar. */
    rawAddress: text("raw_address").notNull(),
    /** Direccion tal y como la devolvio el geocodificador. */
    formattedAddress: text("formatted_address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    state: text("state", { enum: LEAD_STATES }).notNull().default("nuevo"),
    /** Por que se perdio o se descarto. Un estado sin motivo no sirve. */
    stateReason: text("state_reason"),

    /** Canal de entrada. Hoy solo web; el modelo ya admite mas. */
    channel: text("channel").notNull().default("web"),
    campaign: text("campaign"),

    notes: text("notes"),
  },
  (table) => [
    index("solar_leads_state_idx").on(table.state),
    index("solar_leads_created_idx").on(table.createdAt),
    index("solar_leads_email_idx").on(table.email),
  ],
).enableRLS();

/**
 * Registro de consentimiento.
 *
 * Tabla aparte y solo-anadir: un consentimiento no se edita. Retirarlo marca
 * `withdrawnAt`, de modo que el historial completo queda reconstruible.
 */
export const consents = pgTable(
  "solar_consents",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),

    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),

    /** Identificador de la version mostrada. */
    version: text("version").notNull(),
    /** Copia literal del texto que la persona leyo. No es redundante. */
    textShown: text("text_shown").notNull(),
    purpose: text("purpose").notNull(),
    channel: text("channel").notNull(),
  },
  (table) => [index("solar_consents_lead_idx").on(table.leadId)],
).enableRLS();

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
export const studies = pgTable(
  "solar_studies",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),

    recommendedKWp: doublePrecision("recommended_kwp").notNull(),
    annualProductionKWh: doublePrecision("annual_production_kwh").notNull(),
    investmentEUR: doublePrecision("investment_eur").notNull(),
    firstYearSavingsEUR: doublePrecision("first_year_savings_eur").notNull(),
    paybackYears: doublePrecision("payback_years"),
    confidence: text("confidence", { enum: ["alta", "media", "baja"] }).notNull(),

    /** `PreliminaryStudy` serializado. */
    payload: jsonb("payload").notNull(),
  },
  (table) => [index("solar_studies_lead_idx").on(table.leadId)],
).enableRLS();

export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type ConsentRow = typeof consents.$inferSelect;
export type StudyRow = typeof studies.$inferSelect;
