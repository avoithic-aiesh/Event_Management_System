const router = require("express").Router();
const Event = require("../models/Event");
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const httpError = require("../utils/httpError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const adminOnly = [verifyToken, authorizeRoles("ADMIN", "SUPER_ADMIN")];

function checkId(req) {
  if (!UUID_RE.test(req.params.id)) throw httpError(400, "Invalid event id");
}

function parseDate(value, name) {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw httpError(400, `${name} must be a valid date`);
  return date;
}

// Checks the fields in `body` and returns the cleaned values.
// With `requireAll` (create), title, venue, startsAt, endsAt and capacity must all be present.
// Without it (update), only the fields that were sent are checked.
function validate(body, requireAll) {
  const out = {};
  const sent = (key) => body[key] !== undefined;

  if (requireAll || sent("title")) {
    if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 150) {
      throw httpError(400, "Title must be 3 to 150 characters");
    }
    out.title = body.title.trim();
  }
  if (sent("description")) {
    if (typeof body.description !== "string") throw httpError(400, "Description must be text");
    out.description = body.description.trim();
  }
  if (requireAll || sent("venue")) {
    if (typeof body.venue !== "string" || !body.venue.trim() || body.venue.trim().length > 200) {
      throw httpError(400, "Venue is required (max 200 characters)");
    }
    out.venue = body.venue.trim();
  }
  if (requireAll || sent("startsAt")) out.startsAt = parseDate(body.startsAt, "startsAt");
  if (requireAll || sent("endsAt")) out.endsAt = parseDate(body.endsAt, "endsAt");
  if (requireAll || sent("capacity")) {
    if (!Number.isInteger(body.capacity) || body.capacity < 1) {
      throw httpError(400, "Capacity must be a whole number of 1 or more");
    }
    out.capacity = body.capacity;
  }
  if (sent("status")) {
    if (!Event.STATUSES.includes(body.status)) {
      throw httpError(400, `Status must be one of: ${Event.STATUSES.join(", ")}`);
    }
    out.status = body.status;
  }
  return out;
}

// GET /api/events  (public)
router.get("/", async (_req, res) => {
  res.json({ events: await Event.list() });
});

// GET /api/events/:id  (public)
router.get("/:id", async (req, res) => {
  checkId(req);
  const event = await Event.findById(req.params.id);
  if (!event) throw httpError(404, "Event not found");
  res.json({ event });
});

// POST /api/events  { title, description?, venue, startsAt, endsAt, capacity }  (ADMIN, SUPER_ADMIN)
router.post("/", ...adminOnly, async (req, res) => {
  const data = validate(req.body || {}, true);
  if (data.endsAt <= data.startsAt) throw httpError(400, "endsAt must be after startsAt");

  const event = await Event.create({ ...data, createdBy: req.user.id });
  res.status(201).json({ event });
});

// PATCH /api/events/:id  (ADMIN, SUPER_ADMIN)  Send only the fields to change.
router.patch("/:id", ...adminOnly, async (req, res) => {
  checkId(req);
  const changes = validate(req.body || {}, false);

  const current = await Event.findById(req.params.id);
  if (!current) throw httpError(404, "Event not found");

  const startsAt = changes.startsAt || current.startsAt;
  const endsAt = changes.endsAt || current.endsAt;
  if (endsAt <= startsAt) throw httpError(400, "endsAt must be after startsAt");

  res.json({ event: await Event.update(req.params.id, changes) });
});

// DELETE /api/events/:id  (ADMIN, SUPER_ADMIN)
router.delete("/:id", ...adminOnly, async (req, res) => {
  checkId(req);
  if (!(await Event.remove(req.params.id))) throw httpError(404, "Event not found");
  res.status(204).end();
});

module.exports = router;
