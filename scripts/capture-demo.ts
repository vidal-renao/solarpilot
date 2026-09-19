/**
 * Genera las capturas del README contra una base efimera.
 *
 * Orquesta las tres piezas: levanta PGlite con datos ficticios, arranca el
 * servidor de Next apuntando ahi, ejecuta las capturas y lo apaga todo. La
 * base real no se toca en ningun momento.
 *
 * Uso: npm run capture:demo
 */

import { spawn, type ChildProcess } from "node:child_process";

import { startDemoDatabase } from "./demo-db";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

function esperarServidor(maxMs = 120_000): Promise<void> {
  const limite = Date.now() + maxMs;
  return new Promise((resolve, reject) => {
    const intentar = async () => {
      try {
        const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
        if (res.ok) return resolve();
      } catch {
        // Todavia arrancando.
      }
      if (Date.now() > limite) return reject(new Error("El servidor no arranco a tiempo"));
      setTimeout(intentar, 1500);
    };
    void intentar();
  });
}

async function main() {
  console.log("Levantando base efimera con datos ficticios...");
  const db = await startDemoDatabase();

  let next: ChildProcess | undefined;
  try {
    console.log(`Arrancando Next en el puerto ${PORT}...`);
    next = spawn("npx", ["next", "dev", "--port", String(PORT)], {
      env: { ...process.env, DATABASE_URL: db.url },
      stdio: "ignore",
      shell: process.platform === "win32",
    });

    await esperarServidor();
    console.log("Servidor listo.\n");

    // El script de captura corre aparte para poder usarse tambien a mano.
    await new Promise<void>((resolve, reject) => {
      const captura = spawn("npx", ["tsx", "scripts/capture.ts"], {
        env: { ...process.env, CAPTURE_URL: BASE },
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      captura.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`La captura fallo con codigo ${code}`)),
      );
    });
  } finally {
    next?.kill();
    await db.stop();
    console.log("\nBase efimera y servidor apagados.");
  }
}

main().catch((error) => {
  console.error(`\nFALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
