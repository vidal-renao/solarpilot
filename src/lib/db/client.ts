import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Conexion a la base de datos.
 *
 * En desarrollo, Next recarga los modulos en caliente. Sin un cache en el
 * ambito global cada recarga abriria una conexion nueva y acabaria agotando
 * los descriptores de fichero. Es un patron feo pero necesario, y conocido.
 */
const globalForDb = globalThis as unknown as { __solarpilotClient?: Client };

function client(): Client {
  if (!globalForDb.__solarpilotClient) {
    globalForDb.__solarpilotClient = createClient({
      url: process.env.DATABASE_URL ?? "file:./solarpilot.db",
    });
  }
  return globalForDb.__solarpilotClient;
}

export const db = drizzle(client(), { schema });

export { schema };
