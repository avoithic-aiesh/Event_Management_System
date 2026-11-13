const db = require("../config/db");

function fromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

// Registers a user for an event. Returns { result, registration }.
// result is one of: OK, EVENT_NOT_FOUND, EVENT_CANCELLED, ALREADY_REGISTERED, EVENT_FULL.
// The event row is locked inside a transaction, so two people taking the last
// seat at the same moment cannot both get it.
async function register(eventId, userId) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows: events } = await client.query(
      "SELECT capacity, status FROM events WHERE id = $1 FOR UPDATE",
      [eventId]
    );
    const event = events[0];
    if (!event) return await finish(client, "EVENT_NOT_FOUND");
    if (event.status !== "PUBLISHED") return await finish(client, "EVENT_CANCELLED");

    const { rows: existing } = await client.query(
      "SELECT 1 FROM registrations WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );
    if (existing.length > 0) return await finish(client, "ALREADY_REGISTERED");

    const { rows: counts } = await client.query(
      "SELECT COUNT(*)::int AS taken FROM registrations WHERE event_id = $1",
      [eventId]
    );
    if (counts[0].taken >= event.capacity) return await finish(client, "EVENT_FULL");

    const { rows } = await client.query(
      "INSERT INTO registrations (event_id, user_id) VALUES ($1, $2) RETURNING id, event_id, user_id, created_at",
      [eventId, userId]
    );
    await client.query("COMMIT");
    return { result: "OK", registration: fromRow(rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Ends the transaction without saving anything and returns the reason.
async function finish(client, result) {
  await client.query("ROLLBACK");
  return { result };
}

// Returns true if a registration was removed, false if there was none.
async function cancel(eventId, userId) {
  const { rowCount } = await db.query(
    "DELETE FROM registrations WHERE event_id = $1 AND user_id = $2",
    [eventId, userId]
  );
  return rowCount > 0;
}

// The events a user has registered for, soonest first.
async function listForUser(userId) {
  const { rows } = await db.query(
    `SELECT r.id, r.created_at, e.id AS event_id, e.title, e.venue, e.starts_at, e.ends_at, e.status
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.user_id = $1
     ORDER BY e.starts_at ASC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    registeredAt: row.created_at,
    event: {
      id: row.event_id,
      title: row.title,
      venue: row.venue,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    },
  }));
}

// Everyone registered for an event, in the order they signed up.
async function listForEvent(eventId) {
  const { rows } = await db.query(
    `SELECT r.id, r.created_at, u.id AS user_id, u.full_name, u.email
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY r.created_at ASC`,
    [eventId]
  );
  return rows.map((row) => ({
    id: row.id,
    registeredAt: row.created_at,
    user: { id: row.user_id, fullName: row.full_name, email: row.email },
  }));
}

module.exports = { register, cancel, listForUser, listForEvent };
