const db = require("../config/db");

const COLUMNS = "id, user_id, event_id, message, is_read, read_at, created_at";

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id ?? null,
    message: row.message,
    read: row.is_read === true,
    isRead: row.is_read === true, // alias for clients that use isRead
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

// Creates a notification for one user.
async function create({ userId, message, eventId = null }) {
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, event_id, message)
     VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [userId, eventId, message]
  );
  return fromRow(rows[0]);
}

// Newest notifications belonging to this user, and only this user.
async function listForUser(userId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(fromRow);
}

async function countUnread(userId) {
  const { rows } = await db.query(
    "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false",
    [userId]
  );
  return rows[0].count;
}

// Marks one of the user's notifications as read. Returns null if it is not theirs.
async function markRead(userId, id) {
  const { rows } = await db.query(
    `UPDATE notifications
     SET is_read = true, read_at = COALESCE(read_at, now())
     WHERE id = $1 AND user_id = $2
     RETURNING ${COLUMNS}`,
    [id, userId]
  );
  return fromRow(rows[0]);
}

// Marks all of the user's unread notifications as read. Returns how many changed.
async function markAllRead(userId) {
  const { rowCount } = await db.query(
    "UPDATE notifications SET is_read = true, read_at = COALESCE(read_at, now()) WHERE user_id = $1 AND is_read = false",
    [userId]
  );
  return rowCount;
}

module.exports = { create, listForUser, countUnread, markRead, markAllRead };
