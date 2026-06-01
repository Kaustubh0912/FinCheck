import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL as string,
};

if (env.jwtSecret === "dev-secret-change-me" && env.nodeEnv === "production") {
  // eslint-disable-next-line no-console
  console.warn("[fincheck] WARNING: using the default JWT secret in production!");
}
