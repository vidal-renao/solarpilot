import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PreliminaryStudy } from "../solar/types";

import { __setTestDatabase, type Database } from "./client";
import * as schema from "./schema";

/**
 * Las pruebas corren contra PGlite: Postgres de verdad compilado a
 * WebAssembly, en memoria. Mismas reglas de tipos, mismas transacciones y
 * mismo comportamiento del JSONB que en produccion, sin levantar un servidor
 * ni depender de la red.
 *
 * El esquema se crea aplicando las mismas migraciones que van a produccion,
 * no con un `CREATE TABLE` escrito aparte que podria divergir.
 */
let pg: PGlite;

type LeadsModule = typeof import("./leads");
let repo: LeadsModule;

function estudioFalso(overrides: Partial<PreliminaryStudy> = {}): PreliminaryStudy {
  return {
    input: {
      location: { latitude: 40.4167, longitude: -3.7035, formattedAddress: "Calle Mayor 1, Madrid" },
      consumption: { annualKWh: 4500, source: "factura" },
      tariff: { importPricePerKWh: 0.22, exportPricePerKWh: 0.06 },
    },
    sizing: {
      value: {
        recommendedKWp: 2.25,
        panelCount: 5,
        panelWattsPeak: 450,
        estimatedAreaM2: 10.5,
        limitingFactor: "consumo",
      },
      provenance: { source: "catalogo", detail: "prueba" },
      confidence: "media",
    },
    energy: {
      value: {
        annualProductionKWh: 3511.3,
        selfConsumedKWh: 2107,
        exportedKWh: 1404.3,
        gridImportKWh: 2393,
        selfConsumptionRatio: 0.6,
        selfSufficiencyRatio: 0.468,
        monthlyProductionKWh: Array.from({ length: 12 }, (_, i) => 200 + i),
      },
      provenance: { source: "pvgis", detail: "prueba" },
      confidence: "baja",
    },
    economics: {
      value: {
        investmentEUR: 3937.5,
        firstYearSavingsEUR: 547.9,
        simplePaybackYears: 7.3,
        lifetimeSavingsEUR: 12_900.4,
        avoidedCO2TonnesPerYear: 0.7,
      },
      provenance: { source: "catalogo", detail: "prueba" },
      confidence: "baja",
    },
    overallConfidence: "baja",
    assumptions: [{ id: "x", description: "d", value: "v", impact: "i" }],
    missingData: ["curva horaria"],
    disclaimer: "Estimacion preliminar.",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const captura = (overrides: Record<string, unknown> = {}) => ({
  name: "Ana Ruiz",
  email: "Ana.Ruiz@example.com",
  phone: "600000000",
  rawAddress: "Calle Mayor 1, Madrid",
  study: estudioFalso(),
  ...overrides,
});

beforeAll(async () => {
  pg = new PGlite();
  const testDb = drizzle(pg, { schema });

  // El tipo de PGlite y el de postgres-js no coinciden, aunque la API de
  // consulta que usa el repositorio es identica. El casting queda acotado
  // aqui y no se filtra al codigo de produccion.
  __setTestDatabase(testDb as unknown as Database);

  const dir = join(process.cwd(), "drizzle");
  const migraciones = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(migraciones.length).toBeGreaterThan(0);

  for (const fichero of migraciones) {
    const sql = readFileSync(join(dir, fichero), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }

  repo = await import("./leads");
});

afterAll(async () => {
  __setTestDatabase(undefined);
  await pg?.close();
});

describe("captureLead", () => {
  it("guarda lead, consentimiento y preestudio juntos", async () => {
    const { leadId, studyId } = await repo.captureLead(captura());

    expect(leadId).toBeTruthy();
    expect(studyId).toBeTruthy();

    const guardado = await repo.getLead(leadId);
    expect(guardado?.lead.name).toBe("Ana Ruiz");
    expect(guardado?.study?.recommendedKWp).toBe(2.25);
  });

  it("normaliza el correo a minusculas para que deduplicar sea posible", async () => {
    const { leadId } = await repo.captureLead(captura({ email: "MAYUS@Example.COM" }));
    const guardado = await repo.getLead(leadId);
    expect(guardado?.lead.email).toBe("mayus@example.com");
  });

  it("conserva los decimales en lugar de truncarlos a entero", async () => {
    // Blindaje: estas columnas se declararon primero como `integer` y habrian
    // convertido 40,4167 en 40 y 7,3 anos en 7.
    const { leadId } = await repo.captureLead(captura());
    const guardado = await repo.getLead(leadId);
    expect(guardado?.lead.latitude).toBeCloseTo(40.4167, 4);
    expect(guardado?.study?.paybackYears).toBeCloseTo(7.3, 1);
    expect(guardado?.study?.investmentEUR).toBeCloseTo(3937.5, 1);
  });

  it("guarda el preestudio entero, con supuestos y procedencia", async () => {
    const { leadId } = await repo.captureLead(captura());
    const guardado = await repo.getLead(leadId);
    const payload = guardado?.study?.payload as PreliminaryStudy;

    expect(payload.assumptions).toHaveLength(1);
    expect(payload.missingData).toContain("curva horaria");
    expect(payload.energy.provenance.source).toBe("pvgis");
    expect(payload.disclaimer).toContain("preliminar");
  });

  it("entra ya con el preestudio disponible, no como lead pelado", async () => {
    const { leadId } = await repo.captureLead(captura());
    const guardado = await repo.getLead(leadId);
    expect(guardado?.lead.state).toBe("preestudio_disponible");
  });
});

describe("moveLead", () => {
  it("mueve un lead de estado", async () => {
    const { leadId } = await repo.captureLead(captura());
    await repo.moveLead(leadId, "contactado");
    expect((await repo.getLead(leadId))?.lead.state).toBe("contactado");
  });

  it("no deja perder un lead sin motivo registrado", async () => {
    const { leadId } = await repo.captureLead(captura());
    await expect(repo.moveLead(leadId, "perdido")).rejects.toThrow(/motivo/i);
    await expect(repo.moveLead(leadId, "perdido", "   ")).rejects.toThrow(/motivo/i);
  });

  it("acepta perderlo cuando el motivo consta", async () => {
    const { leadId } = await repo.captureLead(captura());
    await repo.moveLead(leadId, "perdido", "Cubierta de fibrocemento");
    const guardado = await repo.getLead(leadId);
    expect(guardado?.lead.state).toBe("perdido");
    expect(guardado?.lead.stateReason).toBe("Cubierta de fibrocemento");
  });
});

describe("listado y recuento", () => {
  it("devuelve los leads del mas reciente al mas antiguo", async () => {
    const lista = await repo.listLeads();
    expect(lista.length).toBeGreaterThan(0);
    for (let i = 1; i < lista.length; i += 1) {
      const anterior = lista[i - 1]!.lead.createdAt.getTime();
      const actual = lista[i]!.lead.createdAt.getTime();
      expect(anterior).toBeGreaterThanOrEqual(actual);
    }
  });

  it("cuenta por estado", async () => {
    const counts = await repo.countByState();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe((await repo.listLeads(1000)).length);
  });

  it("devuelve null para un lead que no existe", async () => {
    expect(await repo.getLead("no-existe")).toBeNull();
  });
});
