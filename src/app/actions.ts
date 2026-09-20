"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { clientKey, consume, retryAfterSeconds } from "@/lib/rate-limit";

import { captureLead, moveLead } from "@/lib/db/leads";
import type { LeadState } from "@/lib/db/schema";
import {
  compareScenarios,
  summarise,
  type ScenarioSummary,
  type ScenarioVerdict,
} from "@/lib/solar/compare";
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
  // Condiciona a que incentivos se puede optar.
  clientType: z.enum(["particular", "empresa"]).default("particular"),
  habitualResidence: z.boolean().default(false),
  annualIbiEUR: z.coerce.number().positive().max(100_000).optional(),
});

type StudyParams = z.infer<typeof studySchema>;

export interface ScenarioComparison {
  sinBateria: ScenarioSummary;
  conBateria: ScenarioSummary;
  verdict: ScenarioVerdict;
}

export type StudyResponse =
  | {
      ok: true;
      study: PreliminaryStudy;
      roof: RoofInsight;
      addressPrecise: boolean;
      comparison: ScenarioComparison;
    }
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
    clientType: formData.get("clientType") || undefined,
    habitualResidence: formData.get("habitualResidence") === "on",
    annualIbiEUR: formData.get("annualIbiEUR") || undefined,
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

  const conBateria = (withBattery: boolean): StudyInput => ({
    location: located,
    consumption: { annualKWh: data.annualKWh, source: data.consumptionSource },
    tariff: { importPricePerKWh: data.importPrice, exportPricePerKWh: data.exportPrice },
    geometry,
    usableRoofAreaM2: roof.usableAreaM2,
    withBattery,
    isResidential: data.clientType === "particular",
    // La deduccion del IRPF exige vivienda habitual y certificados. Sin que
    // conste, se muestra como potencial en lugar de descontarse del retorno.
    meetsIrpfConditions: data.clientType === "particular" && data.habitualResidence,
    annualIbiEUR: data.annualIbiEUR,
  });

  const study = buildStudy(conBateria(data.withBattery), production);

  // El otro escenario se calcula tambien: comparten geocodificacion y
  // radiacion, que es lo caro, asi que el coste de tenerlo es casi nulo y
  // ahorra al cliente rehacer el calculo para comparar.
  const alternativo = buildStudy(conBateria(!data.withBattery), production);

  const sin = data.withBattery ? summarise(alternativo) : summarise(study);
  const con = data.withBattery ? summarise(study) : summarise(alternativo);

  return {
    ok: true,
    study,
    roof,
    addressPrecise: located.isPreciseEnough,
    comparison: { sinBateria: sin, conBateria: con, verdict: compareScenarios(sin, con) },
  };
}

/*
 * Cuotas.
 *
 * Calcular cuesta dos llamadas externas, asi que el limite es generoso pero
 * existe: da margen para ajustar la tarifa y recalcular varias veces, y corta
 * en seco a un bot. Guardar es mas caro todavia —recalcula y escribe en la
 * base— y nadie legitimo guarda diez preestudios en un cuarto de hora.
 */
const CUOTA_CALCULO = { limit: 12, windowMs: 60_000 };
const CUOTA_GUARDADO = { limit: 5, windowMs: 15 * 60_000 };

/**
 * Comprueba la cuota de quien pide.
 *
 * Devuelve el mensaje ya redactado, porque un limite que dice "429" no ayuda
 * a nadie: hay que decir cuanto falta y por que.
 */
async function dentroDeCuota(
  rule: { limit: number; windowMs: number },
  accion: string,
): Promise<string | null> {
  const key = clientKey(await headers());
  const resultado = consume(`${accion}:${key}`, rule);
  if (resultado.allowed) return null;

  const segundos = retryAfterSeconds(resultado.retryAfterMs);
  return (
    `Has hecho muchas peticiones seguidas. Espera ${segundos} segundo${segundos === 1 ? "" : "s"} ` +
    "y vuelve a intentarlo. El limite existe porque cada calculo consulta servicios publicos " +
    "que tienen su propia cuota."
  );
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
  const limitado = await dentroDeCuota(CUOTA_CALCULO, "calculo");
  if (limitado) return { ok: false, error: limitado };

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
  const limitado = await dentroDeCuota(CUOTA_GUARDADO, "guardado");
  if (limitado) return { ok: false, error: limitado };

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
