const db = require("../config/db");

const ROLES = ["MEMBER", "ADMIN", "SUPER_ADMIN"];

const PUBLIC_COLUMNS = "id, full_name, email, role, status, created_at";

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    passwordHash: row.password_hash, // only present when the query selected it
  };
}

// Safe to send to the browser: never includes the password hash.
function toPublic(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// Includes the password hash. Only for login.
async function findByEmail(email) {
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  return fromRow(rows[0]);
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return fromRow(rows[0]);
}

async function create({ fullName, email, passwordHash, role = "MEMBER" }) {
  const { rows } = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING ${PUBLIC_COLUMNS}`,
    [fullName, email, passwordHash, role]
  );
  return fromRow(rows[0]);
}

async function list() {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`);
  return rows.map(fromRow);
}

async function updateRole(id, role) {
  const { rows } = await db.query(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, role]
  );
  return fromRow(rows[0]);
}

module.exports = { ROLES, toPublic, findByEmail, findById, create, list, updateRole };
