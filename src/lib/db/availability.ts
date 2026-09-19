/**
 * Distingue "la base no esta configurada" de "la base ha fallado".
 *
 * Son dos situaciones distintas y merecen respuestas distintas: la primera
 * es un despliegue a medio terminar y se arregla poniendo una variable de
 * entorno; la segunda es una averia. Tratar ambas como un error 500 deja al
 * visitante sin saber cual de las dos esta viendo, y a quien mantiene el
 * proyecto sin saber donde mirar.
 */

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export type DataResult<T> =
  | { status: "ok"; data: T }
  | { status: "sin_configurar" }
  | { status: "error"; message: string };

/** Ejecuta una consulta devolviendo el motivo cuando no se puede. */
export async function tryQuery<T>(run: () => Promise<T>): Promise<DataResult<T>> {
  if (!isDatabaseConfigured()) return { status: "sin_configurar" };
  try {
    return { status: "ok", data: await run() };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
