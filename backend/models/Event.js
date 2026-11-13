const db = require("../config/db");

const STATUSES = ["PUBLISHED", "CANCELLED"];

const COLUMNS = "id, title, description, venue, starts_at, ends_at, capacity, status, created_by, created_at";

// Fields an update may change, mapped to their column names.
const UPDATABLE = {
  title: "title",
  description: "description",
  venue: "venue",
  startsAt: "starts_at",
  endsAt: "ends_at",
  capacity: "capacity",
  status: "status",
};

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

async function list() {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM events ORDER BY starts_at ASC`);
  return rows.map(fromRow);
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM events WHERE id = $1`, [id]);
  return fromRow(rows[0]);
}

async function create({ title, description = "", venue, startsAt, endsAt, capacity, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO events (title, description, venue, starts_at, ends_at, capacity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
    [title, description, venue, startsAt, endsAt, capacity, createdBy]
  );
  return fromRow(rows[0]);
}

// Updates only the fields present in `changes`. Unknown keys are ignored.
async function update(id, changes) {
  const keys = Object.keys(changes).filter((key) => key in UPDATABLE);
  if (keys.length === 0) return findById(id);

  const sets = keys.map((key, i) => `${UPDATABLE[key]} = $${i + 2}`).join(", ");
  const { rows } = await db.query(
    `UPDATE events SET ${sets} WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...keys.map((key) => changes[key])]
  );
  return fromRow(rows[0]);
}

// Returns true if an event was deleted, false if the id did not exist.
async function remove(id) {
  const { rowCount } = await db.query("DELETE FROM events WHERE id = $1", [id]);
  return rowCount > 0;
}

module.exports = { STATUSES, list, findById, create, update, remove };
