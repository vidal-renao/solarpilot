/**
 * Base de datos efimera para las capturas.
 *
 * Levanta PGlite —Postgres en WebAssembly— escuchando en un puerto, aplica
 * las migraciones y siembra seis leads ficticios. El servidor de desarrollo
 * apunta ahi mientras se toman las capturas.
 *
 * Por que existe: las capturas salian de la base real, que contiene leads de
 * personas. Una de ellas se colo en una imagen destinada a un repositorio
 * publico. Aislar la captura elimina la posibilidad de raiz, en lugar de
 * confiar en que nadie se despiste.
 *
 * Efecto secundario util: cualquiera que clone el repositorio puede
 * regenerar las capturas sin tener credenciales de nada.
 *
 * Uso: se arranca solo desde `npm run capture:demo`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export const DEMO_PORT = 5433;
export const DEMO_URL = `postgresql://postgres:postgres@127.0.0.1:${DEMO_PORT}/postgres`;

/** Leads de muestra. Nombres y direcciones inventados, a proposito. */
const LEADS = [
  { name: "Ana Belmonte", email: "ana.belmonte@example.com", city: "Valencia", kwp: 2.25, prod: 3481, inv: 3937.5, save: 533, back: 7.5, conf: "baja", state: "preestudio_disponible", addr: "12, Calle Colon, Valencia" },
  { name: "Distribuciones Almenara", email: "compras@almenara.example", city: "Cartagena", kwp: 45, prod: 71_550, inv: 47_250, save: 8743, back: 5.5, conf: "media", state: "propuesta_enviada", addr: "Poligono Industrial Cabezo Beaza, Cartagena" },
  { name: "Jorge Iriarte", email: "jiriarte@example.com", city: "Zaragoza", kwp: 4.5, prod: 6912, inv: 9165, back: 10.5, save: 1242, conf: "baja", state: "contactado", addr: "10, Paseo de Sagasta, Zaragoza" },
  { name: "Hotel Puerta del Arenal", email: "mantenimiento@puertadelarenal.example", city: "Sevilla", kwp: 20.7, prod: 33_534, inv: 23_805, save: 5073, back: 4.3, conf: "media", state: "ganado", addr: "20, Avenida de la Constitucion, Sevilla" },
  { name: "Marta Esquivel", email: "marta.esquivel@example.com", city: "Santiago", kwp: 2.25, prod: 2790, inv: 3937.5, save: 446, back: 9, conf: "baja", state: "perdido", addr: "20, Rua do Franco, Santiago de Compostela", reason: "Edificio protegido: la cubierta no admite modulos vistos" },
  { name: "Comunidad Plaza Mayor 1", email: "administracion@cpmayor1.example", city: "Madrid", kwp: 9.45, prod: 14_745, inv: 12_285, save: 2284, back: 5.4, conf: "baja", state: "preestudio_disponible", addr: "1, Plaza Mayor, Madrid" },
];

function estudio(l: (typeof LEADS)[number]) {
  const meses = [0.63, 0.7, 0.88, 0.89, 0.96, 0.97, 1, 0.97, 0.87, 0.78, 0.63, 0.59];
  return {
    input: {
      location: { latitude: 40, longitude: -3, formattedAddress: l.addr },
      consumption: { annualKWh: Math.round(l.prod / 0.8), source: "factura" },
      tariff: { importPricePerKWh: 0.22, exportPricePerKWh: 0.06 },
    },
    sizing: {
      value: { recommendedKWp: l.kwp, panelCount: Math.round((l.kwp * 1000) / 450), panelWattsPeak: 450, estimatedAreaM2: Math.round(l.kwp * 4.67 * 10) / 10, limitingFactor: "consumo" },
      provenance: { source: "catalogo", detail: "Panel de 450 Wp, ajustado a numero entero de modulos." },
      confidence: "media",
    },
    energy: {
      value: {
        annualProductionKWh: l.prod,
        selfConsumedKWh: Math.round(l.prod * 0.6),
        exportedKWh: Math.round(l.prod * 0.4),
        gridImportKWh: Math.round(l.prod * 0.55),
        selfConsumptionRatio: 0.6,
        selfSufficiencyRatio: 0.47,
        monthlyProductionKWh: meses.map((m) => Math.round((l.prod / 12) * m * 1.25)),
      },
      provenance: { source: "pvgis", detail: "PVGIS, serie medida para las coordenadas." },
      confidence: l.conf,
    },
    economics: {
      value: {
        investmentEUR: l.inv, netInvestmentEUR: l.inv,
        firstYearSavingsEUR: l.save,
        selfConsumptionSavingsEUR: Math.round(l.save * 0.86),
        compensationEUR: Math.round(l.save * 0.14),
        compensationCapped: false, uncompensatedExportKWh: 0,
        simplePaybackYears: l.back,
        lifetimeSavingsEUR: Math.round(l.save * 23),
        avoidedCO2TonnesPerYear: Math.round((l.prod * 0.2) / 100) / 10,
        schedule: [], sensitivity: [],
      },
      provenance: { source: "catalogo", detail: "Precios de catalogo de demostracion." },
      confidence: l.conf,
    },
    incentives: { applied: [], potential: [], appliedTotalEUR: 0, potentialTotalEUR: 0 },
    overallConfidence: l.conf,
    assumptions: [],
    missingData: ["Curva de carga horaria del punto de suministro."],
    disclaimer: "Estimacion preliminar con fines comerciales.",
    generatedAt: new Date().toISOString(),
  };
}

export async function startDemoDatabase() {
  const pg = new PGlite();
  await pg.waitReady;

  const dir = join(process.cwd(), "drizzle");
  for (const fichero of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, fichero), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }

  const ahora = Date.now();
  for (const [i, l] of LEADS.entries()) {
    const leadId = `demo-lead-${i}`;
    // Fechas escalonadas para que el listado no salga todo con la misma hora.
    const creado = new Date(ahora - (LEADS.length - i) * 3_600_000).toISOString();

    await pg.query(
      `insert into solar_leads (id, created_at, updated_at, name, email, raw_address,
        formatted_address, latitude, longitude, state, state_reason, channel)
       values ($1,$2,$2,$3,$4,$5,$5,40,-3,$6,$7,'web')`,
      [leadId, creado, l.name, l.email, l.addr, l.state, l.reason ?? null],
    );

    await pg.query(
      `insert into solar_studies (id, lead_id, created_at, recommended_kwp,
        annual_production_kwh, investment_eur, first_year_savings_eur,
        payback_years, confidence, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [`demo-study-${i}`, leadId, creado, l.kwp, l.prod, l.inv, l.save, l.back, l.conf, JSON.stringify(estudio(l))],
    );
  }

  const server = new PGLiteSocketServer({ db: pg, port: DEMO_PORT, host: "127.0.0.1" });
  await server.start();

  return {
    url: DEMO_URL,
    async stop() {
      await server.stop();
      await pg.close();
    },
  };
}
