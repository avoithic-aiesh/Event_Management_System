require("dotenv").config({ quiet: true });

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
};

// Stop at startup with a clear message instead of failing later.
if (!env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set in .env and be at least 32 characters long.");
  process.exit(1);
}

module.exports = env;
