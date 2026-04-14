import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

if (!pool) {
  console.warn("[db] DATABASE_URL is not set; database features are disabled");
} else {
  pool.on("error", (err) => {
    console.error("Unexpected Postgres client error:", err);
  });
}
