const router = require("express").Router();
const Notification = require("../models/Notification");
const { verifyToken } = require("../middleware/auth");
const httpError = require("../utils/httpError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/notifications  (any logged-in user)  Only the caller's own notifications.
router.get("/", verifyToken, async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.listForUser(req.user.id),
    Notification.countUnread(req.user.id),
  ]);
  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/read-all  Mark all of the caller's notifications read.
// Declared before /:id/read so "read-all" is never read as a notification id.
router.patch("/read-all", verifyToken, async (req, res) => {
  res.json({ updated: await Notification.markAllRead(req.user.id) });
});

// PATCH /api/notifications/:id/read  Mark one of the caller's notifications read.
router.patch("/:id/read", verifyToken, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) throw httpError(400, "Invalid notification id");

  const notification = await Notification.markRead(req.user.id, req.params.id);
  if (!notification) throw httpError(404, "Notification not found");
  res.json({ notification });
});

module.exports = router;
