import dotenv from "dotenv";

import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL || (() => { throw new Error("DATABASE_URL is required"); })(),
};

if (env.jwtSecret === "dev-secret-change-me" && env.nodeEnv === "production") {
   
  console.warn("[fincheck] WARNING: using the default JWT secret in production!");
}
