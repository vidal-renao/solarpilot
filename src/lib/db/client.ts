import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Conexion a Postgres.
 *
 * Dos ajustes que no son opcionales en un despliegue sin servidor sobre
 * Supabase:
 *
 * - `prepare: false`. El agrupador de Supabase trabaja en modo transaccion,
 *   donde las sentencias preparadas no sobreviven de una transaccion a la
 *   siguiente. Dejarlo activo provoca errores intermitentes que solo aparecen
 *   bajo concurrencia, de los peores de diagnosticar.
 * - `max: 1`. Cada funcion sin servidor es un proceso efimero; abrir un grupo
 *   de conexiones por invocacion agota el limite del agrupador enseguida.
 *
 * La conexion se crea de forma perezosa, en la primera consulta. Si se creara
 * al importar el modulo, compilar el proyecto exigiria tener una base
 * disponible, y no la necesita.
 */
const globalForDb = globalThis as unknown as {
  __solarpilotSql?: ReturnType<typeof postgres>;
  __solarpilotDb?: Database;
};

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y apunta a tu Postgres.",
    );
  }
  return url;
}

/**
 * Decide si exigir TLS.
 *
 * Supabase rechaza las conexiones sin cifrar, pero una cadena pegada del
 * panel puede venir sin `sslmode`, y postgres-js no lo activa por su cuenta.
 * El fallo aparece solo en produccion y con un mensaje que no apunta al TLS,
 * asi que se decide aqui: si la URL ya lo especifica se respeta, y si no, se
 * exige salvo en local, donde lo habitual es un Postgres sin certificado.
 */
function sslMode(url: string): "require" | false | undefined {
  if (/[?&]sslmode=/.test(url)) return undefined;
  const esLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return esLocal ? false : "require";
}

function resolve(): Database {
  if (!globalForDb.__solarpilotDb) {
    const url = connectionString();
    globalForDb.__solarpilotSql ??= postgres(url, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      ssl: sslMode(url),
    });
    globalForDb.__solarpilotDb = drizzle(globalForDb.__solarpilotSql, { schema });
  }
  return globalForDb.__solarpilotDb;
}

/**
 * Sustituye la base por otra. Solo para pruebas.
 *
 * Las pruebas corren contra PGlite, que es Postgres compilado a WebAssembly:
 * mismas reglas de tipos y mismas transacciones, sin levantar un servidor.
 * La alternativa —inyectar la base por parametro en cada funcion del
 * repositorio— ensuciaria todas las llamadas del codigo de produccion para
 * beneficio exclusivo de las pruebas.
 */
export function __setTestDatabase(instance: Database | undefined): void {
  globalForDb.__solarpilotDb = instance;
}

/**
 * Acceso perezoso: la conexion no se abre hasta la primera consulta real.
 * Los metodos se enlazan a su objeto para que `db.transaction(...)` conserve
 * su contexto.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const actual = resolve();
    const value = Reflect.get(actual, property, receiver);
    return typeof value === "function" ? value.bind(actual) : value;
  },
});

export { schema };
