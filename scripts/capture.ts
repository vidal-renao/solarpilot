/**
 * Capturas para el README.
 *
 * Se generan con el navegador, no a mano: asi se pueden regenerar cuando
 * cambie el diseno sin depender de que alguien acierte con el encuadre. Cada
 * captura ejecuta el recorrido real de la aplicacion, de modo que si una
 * pagina se rompe, el script falla en lugar de guardar una imagen vacia.
 *
 * Uso, con el servidor de desarrollo levantado:
 *   npm run capture
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { chromium, type Page } from "playwright";

const BASE = process.env.CAPTURE_URL ?? "http://localhost:3000";
const OUT = join(process.cwd(), "docs");

/** Densidad doble: en GitHub se ven en pantallas de retina. */
const VIEWPORT = { width: 1280, height: 900 };
const SCALE = 2;

async function esperarRed(page: Page) {
  await page.waitForLoadState("networkidle");
  // Las barras del arco solar entran escalonadas; se deja terminar.
  await page.waitForTimeout(1200);
}

/**
 * Navega tolerando la compilacion bajo demanda.
 *
 * En desarrollo Next compila cada ruta la primera vez que se pide, y una
 * navegacion que llega antes de que termine se aborta. Se calienta la ruta
 * con una peticion normal y se reintenta una vez.
 */
async function irA(page: Page, url: string) {
  await fetch(url).catch(() => {});
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch {
    await page.waitForTimeout(2000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
}

/** El indicador de desarrollo de Next no pinta nada en una captura. */
async function ocultarHerramientasDeDesarrollo(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }",
  });
}

/**
 * Leads ficticios del sembrado. Son los unicos que pueden salir en una
 * captura destinada a un repositorio publico.
 */
const LEADS_DEMO = [
  "Ana Belmonte",
  "Distribuciones Almenara",
  "Jorge Iriarte",
  "Hotel Puerta del Arenal",
  "Marta Esquivel",
  "Comunidad Plaza Mayor 1",
];

/** El lead cuya propuesta se captura. Empresa, sin datos de particular. */
const LEAD_PARA_PROPUESTA = "Hotel Puerta del Arenal";

/**
 * Se niega a capturar si hay algun lead que no sea del sembrado.
 *
 * Existe porque ya paso: una prueba hecha sobre el despliegue real dejo en la
 * base el nombre, el telefono y el domicilio de una persona, y la captura los
 * recogio. Publicar eso en un repositorio publico habria sido una fuga de
 * datos personales por descuido.
 *
 * Preferible que el script falle a que publique a alguien.
 */
async function exigirSoloDatosFicticios(page: Page) {
  const nombres = await page.locator('a[href^="/propuesta/"]').allInnerTexts();
  const intrusos = nombres
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && !LEADS_DEMO.includes(n));

  if (intrusos.length > 0) {
    throw new Error(
      `La base contiene leads que no son del sembrado: ${intrusos.join(", ")}. ` +
        "Pueden ser datos personales reales y no deben acabar en una captura publica. " +
        "Revisalos y elimina los que sobren antes de volver a ejecutar esto.",
    );
  }
}

/**
 * Escribe como escribiria una persona.
 *
 * `fill()` asigna el valor por el setter nativo y React no siempre se entera,
 * de modo que el formulario envia bien pero queda vacio en pantalla al
 * re-renderizar: la captura saldria con los campos en blanco.
 */
async function escribir(page: Page, etiqueta: string | RegExp, texto: string) {
  const campo = page.getByLabel(etiqueta);
  await campo.click();
  await campo.press("ControlOrMeta+a");
  await campo.pressSequentially(texto, { delay: 12 });
}

async function capturarCalculador(page: Page) {
  await irA(page, BASE);
  await ocultarHerramientasDeDesarrollo(page);

  await escribir(page, "Direccion", "Avenida de la Constitucion 20, Sevilla");
  await escribir(page, "Consumo al año", "5200");

  // Se despliegan los ajustes para marcar vivienda habitual: asi la captura
  // muestra la deduccion del IRPF ya aplicada, que es el caso interesante.
  await page.getByText("Ajustar tarifa, cubierta y bateria").click();
  await page.getByLabel(/vivienda habitual/i).check();

  await page.getByRole("button", { name: "Calcular" }).click();

  // El calculo llama a dos servicios externos: se espera al resultado real.
  await page.getByRole("heading", { name: /de donde sale el ahorro/i }).waitFor({
    timeout: 45_000,
  });
  await esperarRed(page);

  await page.screenshot({ path: join(OUT, "calculador.png"), fullPage: true });
  console.log("  docs/calculador.png");
}

async function capturarProceso(page: Page) {
  await irA(page, `${BASE}/proceso`);
  await ocultarHerramientasDeDesarrollo(page);
  await page.getByRole("heading", { name: /del preestudio/i }).waitFor();
  await esperarRed(page);

  await page.screenshot({ path: join(OUT, "proceso.png"), fullPage: true });
  console.log("  docs/proceso.png");
}

async function capturarPipeline(page: Page) {
  await irA(page, `${BASE}/pipeline`);
  await ocultarHerramientasDeDesarrollo(page);
  await page.getByRole("heading", { name: "Pipeline" }).waitFor();
  await exigirSoloDatosFicticios(page);
  await esperarRed(page);

  await page.screenshot({ path: join(OUT, "pipeline.png"), fullPage: true });
  console.log("  docs/pipeline.png");
}

async function capturarPropuesta(page: Page) {
  await irA(page, `${BASE}/pipeline`);

  await ocultarHerramientasDeDesarrollo(page);
  await page.getByRole("heading", { name: "Pipeline" }).waitFor();
  await exigirSoloDatosFicticios(page);

  // Un lead concreto y conocido, no "el primero de la lista": asi la captura
  // es reproducible y nunca depende de que orden traiga la base.
  const enlace = page.locator('a[href^="/propuesta/"]', {
    hasText: LEAD_PARA_PROPUESTA,
  });
  await enlace.waitFor();
  await enlace.click();

  await page.getByRole("heading", { name: /propuesta de instalaci/i }).waitFor();
  await ocultarHerramientasDeDesarrollo(page);
  await esperarRed(page);

  await page.screenshot({ path: join(OUT, "propuesta.png"), fullPage: true });
  console.log("  docs/propuesta.png");
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: "es-ES",
    // Sin animaciones el resultado es reproducible entre ejecuciones.
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  console.log(`Capturando desde ${BASE}\n`);
  try {
    await capturarCalculador(page);
    await capturarProceso(page);
    await capturarPipeline(page);
    await capturarPropuesta(page);
    console.log("\nCapturas generadas en docs/.");
  } catch (error) {
    // Una captura que falla deja el estado a la vista en lugar de solo el
    // mensaje: casi siempre el motivo esta en la pantalla.
    await page
      .screenshot({ path: join(OUT, "_fallo.png"), fullPage: true })
      .catch(() => {});
    console.error("\nEstado en el momento del fallo guardado en docs/_fallo.png");
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`\nFALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
