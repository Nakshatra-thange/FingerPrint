import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  : null;

pool?.on("error", (err) => {
  console.error("Unexpected Postgres client error:", err);
});
