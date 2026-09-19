import { desc, eq } from "drizzle-orm";

import { currentConsent } from "../consent";
import type { PreliminaryStudy } from "../solar/types";

import { db } from "./client";
import { consents, leads, studies, type LeadRow, type LeadState, type StudyRow } from "./schema";

export interface CaptureInput {
  name: string;
  email: string;
  phone?: string;
  rawAddress: string;
  channel?: string;
  campaign?: string;
  study: PreliminaryStudy;
}

export interface CapturedLead {
  leadId: string;
  studyId: string;
}

/**
 * Guarda el lead, su consentimiento y el preestudio en una sola transaccion.
 *
 * Es una transaccion porque las tres filas solo valen juntas: un lead sin
 * consentimiento no se puede contactar, y un consentimiento sin lead no
 * apunta a nadie. Si una falla no debe quedar ninguna.
 */
export async function captureLead(input: CaptureInput): Promise<CapturedLead> {
  const now = new Date();
  const leadId = crypto.randomUUID();
  const studyId = crypto.randomUUID();
  const consent = currentConsent();
  const channel = input.channel ?? "web";
  const economics = input.study.economics.value;

  await db.transaction(async (tx) => {
    await tx.insert(leads).values({
      id: leadId,
      createdAt: now,
      updatedAt: now,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      rawAddress: input.rawAddress,
      formattedAddress: input.study.input.location.formattedAddress ?? null,
      latitude: input.study.input.location.latitude,
      longitude: input.study.input.location.longitude,
      state: "preestudio_disponible",
      channel,
      campaign: input.campaign ?? null,
    });

    await tx.insert(consents).values({
      id: crypto.randomUUID(),
      leadId,
      grantedAt: now,
      version: consent.version,
      // Copia literal, no referencia: si manana cambia el texto, este registro
      // debe seguir diciendo lo que esta persona leyo hoy.
      textShown: consent.text,
      purpose: consent.purpose,
      channel,
    });

    await tx.insert(studies).values({
      id: studyId,
      leadId,
      createdAt: now,
      recommendedKWp: input.study.sizing.value.recommendedKWp,
      annualProductionKWh: input.study.energy.value.annualProductionKWh,
      investmentEUR: economics.investmentEUR,
      firstYearSavingsEUR: economics.firstYearSavingsEUR,
      paybackYears: economics.simplePaybackYears,
      confidence: input.study.overallConfidence,
      payload: input.study,
    });
  });

  return { leadId, studyId };
}

export interface LeadWithStudy {
  lead: LeadRow;
  study: StudyRow | null;
}

/** Listado del pipeline, del mas reciente al mas antiguo. */
export async function listLeads(limit = 100): Promise<LeadWithStudy[]> {
  const rows = await db
    .select({ lead: leads, study: studies })
    .from(leads)
    .leftJoin(studies, eq(studies.leadId, leads.id))
    .orderBy(desc(leads.createdAt))
    .limit(limit);

  return rows.map((row) => ({ lead: row.lead, study: row.study }));
}

export async function getLead(id: string): Promise<LeadWithStudy | null> {
  const rows = await db
    .select({ lead: leads, study: studies })
    .from(leads)
    .leftJoin(studies, eq(studies.leadId, leads.id))
    .where(eq(leads.id, id))
    .limit(1);

  const row = rows[0];
  return row ? { lead: row.lead, study: row.study } : null;
}

/**
 * Mueve un lead de estado.
 *
 * Los estados terminales exigen motivo: un lead perdido sin razon registrada
 * es una conversion que nadie podra analizar despues.
 */
export async function moveLead(
  id: string,
  state: LeadState,
  reason?: string,
): Promise<void> {
  if (state === "perdido" && !reason?.trim()) {
    throw new Error("Perder un lead exige registrar el motivo");
  }

  await db
    .update(leads)
    .set({ state, stateReason: reason?.trim() || null, updatedAt: new Date() })
    .where(eq(leads.id, id));
}

/** Recuento por estado, para la cabecera del pipeline. */
export async function countByState(): Promise<Record<LeadState, number>> {
  const rows = await db.select({ state: leads.state }).from(leads);
  const counts = {} as Record<LeadState, number>;
  for (const row of rows) {
    counts[row.state] = (counts[row.state] ?? 0) + 1;
  }
  return counts;
}
