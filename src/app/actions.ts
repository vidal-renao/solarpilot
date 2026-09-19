"use server";

import { z } from "zod";

import { captureLead, moveLead } from "@/lib/db/leads";
import type { LeadState } from "@/lib/db/schema";
import { buildStudy } from "@/lib/solar/engine";
import { geocodeAddressCached, GeocodeError } from "@/lib/solar/geocode";
import { fetchProductionCached, PvgisError } from "@/lib/solar/pvgis";
import { resolveRoof, type RoofInsight } from "@/lib/solar/roof";
import type { ArrayGeometry, PreliminaryStudy, StudyInput } from "@/lib/solar/types";

const studySchema = z.object({
  address: z.string().min(4, "Escribe una direccion algo mas concreta."),
  annualKWh: z.coerce
    .number()
    .positive("El consumo anual tiene que ser mayor que cero.")
    .max(500_000, "Ese consumo se sale del alcance de esta herramienta."),
  importPrice: z.coerce.number().positive().max(2).default(0.22),
  exportPrice: z.coerce.number().min(0).max(2).default(0.06),
  roofAreaM2: z.coerce.number().positive().max(10_000).optional(),
  withBattery: z.boolean().default(false),
  consumptionSource: z.enum(["factura", "curva_horaria", "perfil_tipo"]).default("factura"),
});

type StudyParams = z.infer<typeof studySchema>;

export type StudyResponse =
  | { ok: true; study: PreliminaryStudy; roof: RoofInsight; addressPrecise: boolean }
  | { ok: false; error: string; field?: string };

/** Lee del formulario los campos que definen un preestudio. */
function readStudyFields(formData: FormData) {
  return {
    address: formData.get("address"),
    annualKWh: formData.get("annualKWh"),
    importPrice: formData.get("importPrice") || undefined,
    exportPrice: formData.get("exportPrice") || undefined,
    roofAreaM2: formData.get("roofAreaM2") || undefined,
    withBattery: formData.get("withBattery") === "on",
    consumptionSource: formData.get("consumptionSource") || undefined,
  };
}

/**
 * Calcula el preestudio a partir de parametros ya validados.
 *
 * Es la unica ruta de calculo: tanto la vista previa como el guardado pasan
 * por aqui. Con geocodificacion y radiacion cacheadas, repetirlo al guardar
 * apenas cuesta, y a cambio el servidor nunca confia en un resultado que
 * llegue del navegador.
 */
async function computeStudy(data: StudyParams): Promise<StudyResponse> {
  let located;
  try {
    located = await geocodeAddressCached(data.address);
  } catch (error) {
    if (error instanceof GeocodeError) {
      return {
        ok: false,
        error: "El buscador de direcciones no responde. Vuelve a intentarlo en un momento.",
      };
    }
    throw error;
  }

  if (!located) {
    return {
      ok: false,
      error: "No hemos encontrado esa direccion. Anade el numero y el municipio.",
      field: "address",
    };
  }

  const roof = await resolveRoof(located, { declaredAreaM2: data.roofAreaM2 });

  // Si conocemos la geometria real de la cubierta la usamos; si no, PVGIS
  // calcula la inclinacion optima teorica y queda declarado como supuesto.
  const knowsGeometry = roof.tiltDeg !== undefined && roof.azimuthDeg !== undefined;
  const geometry: ArrayGeometry = {
    tiltDeg: roof.tiltDeg ?? 30,
    azimuthDeg: roof.azimuthDeg ?? 0,
    useOptimalAngles: !knowsGeometry,
  };

  let production;
  try {
    production = await fetchProductionCached(located, geometry);
  } catch (error) {
    if (error instanceof PvgisError) {
      return {
        ok: false,
        error:
          "El servicio de radiacion de la Comision Europea no responde ahora mismo. El calculo depende de el, asi que no podemos darte un resultado fiable todavia.",
      };
    }
    throw error;
  }

  const input: StudyInput = {
    location: located,
    consumption: { annualKWh: data.annualKWh, source: data.consumptionSource },
    tariff: { importPricePerKWh: data.importPrice, exportPricePerKWh: data.exportPrice },
    geometry,
    usableRoofAreaM2: roof.usableAreaM2,
    withBattery: data.withBattery,
  };

  return {
    ok: true,
    study: buildStudy(input, production),
    roof,
    addressPrecise: located.isPreciseEnough,
  };
}

function firstIssue(error: z.ZodError): { error: string; field?: string } {
  const issue = error.issues[0];
  return {
    error: issue?.message ?? "Revisa los datos introducidos.",
    field: issue?.path[0]?.toString(),
  };
}

export async function createStudy(
  _previous: StudyResponse | null,
  formData: FormData,
): Promise<StudyResponse> {
  const parsed = studySchema.safeParse(readStudyFields(formData));
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  return computeStudy(parsed.data);
}

/* ------------------------------------------------------------------ */
/* Captura del lead                                                     */
/* ------------------------------------------------------------------ */

const captureSchema = studySchema.extend({
  name: z.string().trim().min(2, "Necesitamos un nombre para dirigirnos a ti."),
  email: z.string().trim().email("Ese correo no parece valido."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => (value ? value : undefined)),
  // Sin marcar no hay nada que guardar. No es una formalidad: es la base
  // legal de todo el tratamiento posterior.
  consent: z.literal(true, {
    errorMap: () => ({ message: "Sin tu permiso no podemos guardar nada ni escribirte." }),
  }),
});

export type CaptureResponse =
  | { ok: true; leadId: string }
  | { ok: false; error: string; field?: string };

export async function captureStudy(
  _previous: CaptureResponse | null,
  formData: FormData,
): Promise<CaptureResponse> {
  const parsed = captureSchema.safeParse({
    ...readStudyFields(formData),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    consent: formData.get("consent") === "on",
  });

  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  // Se recalcula en servidor en lugar de aceptar el resultado que venga del
  // navegador. Es barato gracias al cache y cierra la puerta a guardar un
  // preestudio manipulado.
  const recomputed = await computeStudy(parsed.data);
  if (!recomputed.ok) return { ok: false, error: recomputed.error, field: recomputed.field };

  const { leadId } = await captureLead({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    rawAddress: parsed.data.address,
    study: recomputed.study,
  });

  return { ok: true, leadId };
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                             */
/* ------------------------------------------------------------------ */

export async function advanceLead(
  leadId: string,
  state: LeadState,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await moveLead(leadId, state, reason);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se ha podido mover el lead",
    };
  }
}
