import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // La base puede compartirse con otras aplicaciones: drizzle-kit solo debe
  // mirar lo que es suyo, o propondria borrar tablas ajenas.
  tablesFilter: ["solar_*"],
} satisfies Config;
