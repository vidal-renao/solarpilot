/**
 * Puebla la base con leads de ejemplo.
 *
 * Los preestudios se calculan de verdad, llamando a PVGIS: sembrar cifras
 * inventadas haria que el pipeline ensenase numeros que el motor nunca
 * produciria, y cualquier incoherencia pasaria desapercibida.
 *
 * Uso: npm run db:seed
 */

import { captureLead, moveLead } from "../src/lib/db/leads";
import { buildStudy } from "../src/lib/solar/engine";
import { geocodeAddress } from "../src/lib/solar/geocode";
import { fetchProduction } from "../src/lib/solar/pvgis";
import { resolveRoof } from "../src/lib/solar/roof";
import type { ArrayGeometry, ConsumptionInput, StudyInput } from "../src/lib/solar/types";

interface Ejemplo {
  name: string;
  email: string;
  phone?: string;
  address: string;
  annualKWh: number;
  source: ConsumptionInput["source"];
  roofAreaM2?: number;
  withBattery?: boolean;
  importPrice?: number;
  /** Estado final al que se mueve tras crearlo. */
  state?: Parameters<typeof moveLead>[1];
  reason?: string;
}

const EJEMPLOS: Ejemplo[] = [
  {
    name: "Ana Belmonte",
    email: "ana.belmonte@example.com",
    phone: "600 111 222",
    address: "Calle Colon 12, Valencia",
    annualKWh: 4200,
    source: "factura",
  },
  {
    name: "Distribuciones Almenara",
    email: "compras@almenara.example",
    phone: "968 500 100",
    address: "Poligono Industrial Cabezo Beaza, Cartagena",
    annualKWh: 92_000,
    source: "curva_horaria",
    roofAreaM2: 1600,
    importPrice: 0.16,
    state: "propuesta_enviada",
  },
  {
    name: "Jorge Iriarte",
    email: "jiriarte@example.com",
    address: "Paseo de Sagasta 10, Zaragoza",
    annualKWh: 6100,
    source: "factura",
    withBattery: true,
    state: "contactado",
  },
  {
    name: "Hotel Puerta del Arenal",
    email: "mantenimiento@puertadelarenal.example",
    phone: "954 220 011",
    address: "Avenida de la Constitucion 20, Sevilla",
    annualKWh: 41_000,
    source: "curva_horaria",
    roofAreaM2: 420,
    state: "ganado",
  },
  {
    name: "Marta Esquivel",
    email: "marta.esquivel@example.com",
    address: "Rua do Franco 20, Santiago de Compostela",
    annualKWh: 3800,
    source: "perfil_tipo",
    state: "perdido",
    reason: "Edificio protegido: la cubierta no admite modulos vistos",
  },
  {
    name: "Comunidad Plaza Mayor 1",
    email: "administracion@cpmayor1.example",
    address: "Plaza Mayor 1, Madrid",
    annualKWh: 18_500,
    source: "factura",
    roofAreaM2: 260,
  },
];

/** Nominatim limita a una peticion por segundo. Se respeta. */
const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sembrar(ejemplo: Ejemplo): Promise<string> {
  const located = await geocodeAddress(ejemplo.address);
  if (!located) throw new Error(`Sin geocodificar: ${ejemplo.address}`);

  const roof = await resolveRoof(located, { declaredAreaM2: ejemplo.roofAreaM2 });
  const knowsGeometry = roof.tiltDeg !== undefined && roof.azimuthDeg !== undefined;
  const geometry: ArrayGeometry = {
    tiltDeg: roof.tiltDeg ?? 30,
    azimuthDeg: roof.azimuthDeg ?? 0,
    useOptimalAngles: !knowsGeometry,
  };

  const production = await fetchProduction(located, geometry);

  const input: StudyInput = {
    location: located,
    consumption: { annualKWh: ejemplo.annualKWh, source: ejemplo.source },
    tariff: {
      importPricePerKWh: ejemplo.importPrice ?? 0.22,
      exportPricePerKWh: 0.06,
    },
    geometry,
    usableRoofAreaM2: roof.usableAreaM2,
    withBattery: ejemplo.withBattery,
  };

  const study = buildStudy(input, production);

  const { leadId } = await captureLead({
    name: ejemplo.name,
    email: ejemplo.email,
    phone: ejemplo.phone,
    rawAddress: ejemplo.address,
    study,
  });

  if (ejemplo.state) await moveLead(leadId, ejemplo.state, ejemplo.reason);

  const s = study.sizing.value;
  const ec = study.economics.value;
  console.log(
    `  ${ejemplo.name.padEnd(30)} ${String(s.recommendedKWp).padStart(6)} kWp  ` +
      `${String(Math.round(ec.firstYearSavingsEUR)).padStart(6)} EUR/ano  ` +
      `confianza ${study.overallConfidence}`,
  );

  return leadId;
}

async function main() {
  console.log("Sembrando leads con preestudios reales de PVGIS...\n");

  let creados = 0;
  for (const ejemplo of EJEMPLOS) {
    try {
      await sembrar(ejemplo);
      creados += 1;
    } catch (error) {
      console.error(
        `  ${ejemplo.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await esperar(1200);
  }

  console.log(`\n${creados} de ${EJEMPLOS.length} leads creados.`);
  process.exit(0);
}

void main();
