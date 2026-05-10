import { migrate } from "drizzle-orm/postgres-js/migrator";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db, sql } from "../db/postgres.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const migrationsFolder = resolve(__dirname, "..", "..", "migrations");

async function main() {
  console.log(`Running migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied.");
}

main()
  .catch((error) => {
    console.error("Migration failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
