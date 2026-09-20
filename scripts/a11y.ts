/**
 * Auditoria de accesibilidad con axe.
 *
 * Complementa la revision a mano, no la sustituye: axe encuentra lo mecanico
 * —contraste, etiquetas ausentes, encabezados saltados, regiones sin
 * nombrar— y no puede juzgar si un texto alternativo describe lo que hay que
 * describir. Pero lo mecanico es justo lo que se escapa cuando se mira una
 * pantalla mil veces.
 *
 * Recorre las paginas en los dos temas, porque el contraste depende del tema
 * y auditar solo uno deja la mitad sin mirar.
 *
 * Uso: npm run a11y   (con el servidor de desarrollo levantado)
 */

import AxeBuilder from "@axe-core/playwright";
import { chromium, type Page } from "playwright";

const BASE = process.env.A11Y_URL ?? "http://localhost:3000";

/** Criterios: WCAG 2.1 hasta nivel AA, que es el listón habitual. */
const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

interface Objetivo {
  nombre: string;
  ruta: string;
  /** Interaccion previa, para auditar tambien lo que solo existe tras usarla. */
  preparar?: (page: Page) => Promise<void>;
}

const OBJETIVOS: Objetivo[] = [
  {
    nombre: "Calculador",
    ruta: "/",
  },
  {
    nombre: "Calculador con resultado",
    ruta: "/",
    async preparar(page) {
      const campo = page.getByLabel("Direccion");
      await campo.click();
      await campo.pressSequentially("Plaza Mayor 1, Madrid", { delay: 10 });
      await page.getByRole("button", { name: "Calcular" }).click();
      await page
        .getByRole("heading", { name: /de donde sale el ahorro/i })
        .waitFor({ timeout: 60_000 });
    },
  },
  { nombre: "El proceso", ruta: "/proceso" },
  { nombre: "Pipeline", ruta: "/pipeline" },
];

async function auditar(page: Page, objetivo: Objetivo, tema: "light" | "dark") {
  await page.goto(`${BASE}${objetivo.ruta}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
  if (objetivo.preparar) await objetivo.preparar(page);
  await page.waitForTimeout(600);

  const { violations } = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();

  const etiqueta = `${objetivo.nombre} · tema ${tema === "light" ? "claro" : "oscuro"}`;
  if (violations.length === 0) {
    console.log(`  OK   ${etiqueta}`);
    return 0;
  }

  console.log(`  FALLA ${etiqueta}`);
  for (const v of violations) {
    console.log(`         [${v.impact}] ${v.id}: ${v.help}`);
    for (const nodo of v.nodes.slice(0, 3)) {
      console.log(`           ${nodo.target.join(" ")}`);
      const resumen = nodo.failureSummary?.split("\n").filter(Boolean)[1];
      if (resumen) console.log(`           ${resumen.trim()}`);
    }
    if (v.nodes.length > 3) console.log(`           y ${v.nodes.length - 3} mas`);
  }
  return violations.length;
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "es-ES",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  console.log(`Auditando ${BASE}\n`);
  let total = 0;
  try {
    for (const objetivo of OBJETIVOS) {
      for (const tema of ["dark", "light"] as const) {
        total += await auditar(page, objetivo, tema);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(
    total === 0
      ? "\nSin infracciones de WCAG 2.1 AA."
      : `\n${total} infracciones. Corrígelas antes de dar esto por bueno.`,
  );
  process.exit(total === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nFALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
