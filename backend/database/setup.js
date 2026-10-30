// Creates the users table and three demo accounts (one per role).
// Run with: npm run db:setup
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const db = require("../config/db");

async function main() {
  await db.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  console.log("users table is ready");

  if (env.NODE_ENV === "production") {
    console.log("Production: demo accounts were NOT created.");
    return;
  }

  const password = process.env.SEED_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(password, 10);
  const demoUsers = [
    ["Demo Member", "member@example.com", "MEMBER"],
    ["Demo Admin", "admin@example.com", "ADMIN"],
    ["Demo Super Admin", "superadmin@example.com", "SUPER_ADMIN"],
  ];

  for (const [fullName, email, role] of demoUsers) {
    await db.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      [fullName, email, passwordHash, role]
    );
  }
  console.log(`Demo accounts ready (password: ${password}):`);
  demoUsers.forEach(([, email, role]) => console.log(`  ${role.padEnd(12)} ${email}`));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
