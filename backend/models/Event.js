const db = require("../config/db");

const STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"];

const COLUMNS = "id, title, description, venue, starts_at, ends_at, capacity, status, category, tags, image_url, created_by, created_at";

// Reads also carry how many people are registered, which the routes need
// for the capacity and draft rules.
const READ_COLUMNS = `${COLUMNS},
    (
        SELECT COUNT(*)::int
        FROM registrations r
        WHERE r.event_id = events.id
      ) AS registered_count`;

// Fields an update may change, mapped to their column names.
const UPDATABLE = {
  title: "title",
  description: "description",
  venue: "venue",
  startsAt: "starts_at",
  endsAt: "ends_at",
  capacity: "capacity",
  status: "status",
  category: "category",
  tags: "tags",
  imageUrl: "image_url",
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
    registeredCount:
      row.registered_count === undefined
        ? undefined
        : Number(row.registered_count),
    status: row.status,
    category: row.category ?? null,
    tags: row.tags ?? [],
    imageUrl: row.image_url ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// %, _ and \ are wildcards in LIKE, so a literal search must escape them.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// list({ onlyPublished, search, category, from, to, page, limit })
// Returns { events, total }. `search` matches title OR venue, `category` is an
// exact match, from/to bound starts_at. Paging applies only when `limit` is given.
async function list({ onlyPublished = true, search, category, from, to, page, limit } = {}) {
  const where = [];
  const params = [];

  if (onlyPublished) where.push("status = 'PUBLISHED'");
  if (search) {
    params.push(`%${escapeLike(String(search))}%`);
    where.push(`(title ILIKE $${params.length} OR venue ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`starts_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`starts_at <= $${params.length}`);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const counted = await db.query(`SELECT COUNT(*)::int AS total FROM events${whereSql}`, params);
  const total = counted.rows[0].total;

  const readParams = [...params];
  let paging = "";
  if (limit !== undefined && limit !== null) {
    const currentPage = page && page > 0 ? page : 1;
    readParams.push(limit, (currentPage - 1) * limit);
    paging = ` LIMIT $${readParams.length - 1} OFFSET $${readParams.length}`;
  }

  const { rows } = await db.query(
    `SELECT ${READ_COLUMNS} FROM events${whereSql} ORDER BY starts_at ASC${paging}`,
    readParams
  );
  return { events: rows.map(fromRow), total };
}

// publicOnly hides drafts from visitors and members.
async function findById(id, { publicOnly = false } = {}) {
  let sql = `SELECT ${READ_COLUMNS} FROM events WHERE id = $1`;
  if (publicOnly) sql += " AND status <> 'DRAFT'";
  const { rows } = await db.query(sql, [id]);
  return fromRow(rows[0]);
}

async function create({
  title,
  description = "",
  venue,
  startsAt,
  endsAt,
  capacity,
  status = "DRAFT",
  category = null,
  tags = [],
  imageUrl = null,
  createdBy,
}) {
  const { rows } = await db.query(
    `INSERT INTO events (title, description, venue, starts_at, ends_at, capacity, status, category, tags, image_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [title, description, venue, startsAt, endsAt, capacity, status, category, tags, imageUrl, createdBy]
  );
  return findById(rows[0].id);
}

// Updates only the fields present in `changes`. Unknown keys are ignored.
async function update(id, changes) {
  const keys = Object.keys(changes).filter((key) => key in UPDATABLE);
  if (keys.length === 0) return findById(id);

  const sets = keys.map((key, i) => `${UPDATABLE[key]} = $${i + 2}`).join(", ");
  await db.query(
    `UPDATE events SET ${sets} WHERE id = $1`,
    [id, ...keys.map((key) => changes[key])]
  );
  return findById(id);
}

// Returns true if an event was deleted, false if the id did not exist.
async function remove(id) {
  const { rowCount } = await db.query("DELETE FROM events WHERE id = $1", [id]);
  return rowCount > 0;
}

module.exports = { STATUSES, list, findById, create, update, remove };
