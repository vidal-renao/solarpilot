"use server";

import { z } from "zod";

import { buildStudy } from "@/lib/solar/engine";
import { geocodeAddress, GeocodeError } from "@/lib/solar/geocode";
import { fetchProduction, PvgisError } from "@/lib/solar/pvgis";
import { resolveRoof, type RoofInsight } from "@/lib/solar/roof";
import type { ArrayGeometry, PreliminaryStudy, StudyInput } from "@/lib/solar/types";

const schema = z.object({
  address: z.string().min(4, "Escribe una direccion algo mas concreta."),
  annualKWh: z.coerce
    .number()
    .positive("El consumo anual tiene que ser mayor que cero.")
    .max(500_000, "Ese consumo se sale del alcance de esta herramienta."),
  importPrice: z.coerce.number().positive().max(2).default(0.22),
  exportPrice: z.coerce.number().min(0).max(2).default(0.06),
  roofAreaM2: z.coerce.number().positive().max(10_000).optional(),
  withBattery: z.coerce.boolean().default(false),
  consumptionSource: z.enum(["factura", "curva_horaria", "perfil_tipo"]).default("factura"),
});

export type StudyResponse =
  | { ok: true; study: PreliminaryStudy; roof: RoofInsight; addressPrecise: boolean }
  | { ok: false; error: string; field?: string };

export async function createStudy(
  _previous: StudyResponse | null,
  formData: FormData,
): Promise<StudyResponse> {
  const parsed = schema.safeParse({
    address: formData.get("address"),
    annualKWh: formData.get("annualKWh"),
    importPrice: formData.get("importPrice") || undefined,
    exportPrice: formData.get("exportPrice") || undefined,
    roofAreaM2: formData.get("roofAreaM2") || undefined,
    withBattery: formData.get("withBattery") === "on",
    consumptionSource: formData.get("consumptionSource") || undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Revisa los datos introducidos.",
      field: first?.path[0]?.toString(),
    };
  }

  const data = parsed.data;

  let located;
  try {
    located = await geocodeAddress(data.address);
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
  // calcula la inclinacion optima teorica y lo dejamos declarado.
  const knowsGeometry = roof.tiltDeg !== undefined && roof.azimuthDeg !== undefined;
  const geometry: ArrayGeometry = {
    tiltDeg: roof.tiltDeg ?? 30,
    azimuthDeg: roof.azimuthDeg ?? 0,
    useOptimalAngles: !knowsGeometry,
  };

  let production;
  try {
    production = await fetchProduction(located, geometry);
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
    tariff: {
      importPricePerKWh: data.importPrice,
      exportPricePerKWh: data.exportPrice,
    },
    geometry,
    availableRoofAreaM2: roof.usableAreaM2,
    withBattery: data.withBattery,
  };

  return {
    ok: true,
    study: buildStudy(input, production),
    roof,
    addressPrecise: located.isPreciseEnough,
  };
}
