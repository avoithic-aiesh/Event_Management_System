const router = require("express").Router();
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Notification = require("../models/Notification");
const { verifyToken, optionalAuth, authorizeRoles } = require("../middleware/auth");
const httpError = require("../utils/httpError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const adminOnly = [verifyToken, authorizeRoles("ADMIN", "SUPER_ADMIN")];

// Which statuses an event may be moved to from the one it is in now.
const MOVES = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["DRAFT", "CANCELLED"],
  CANCELLED: ["PUBLISHED"],
};

function checkId(req) {
  if (!UUID_RE.test(req.params.id)) throw httpError(400, "Invalid event id");
}

function checkRegistrationId(req) {
  if (!UUID_RE.test(req.params.registrationId)) throw httpError(400, "Invalid registration id");
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
  if (sent("category")) {
    if (body.category !== null && (typeof body.category !== "string" || body.category.length > 50)) {
      throw httpError(400, "Category must be text of up to 50 characters");
    }
    out.category = body.category;
  }
  if (sent("tags")) {
    const ok =
      Array.isArray(body.tags) &&
      body.tags.length <= 10 &&
      body.tags.every((tag) => typeof tag === "string" && tag.trim() && tag.trim().length <= 30);
    if (!ok) throw httpError(400, "Tags must be a list of up to 10 short texts");
    out.tags = body.tags.map((tag) => tag.trim());
  }
  if (sent("imageUrl")) {
    const value = body.imageUrl;
    const ok =
      value === null ||
      value === "" ||
      (typeof value === "string" && value.length <= 500 && /^https?:\/\//i.test(value));
    if (!ok) throw httpError(400, "Image must be an http(s) link");
    out.imageUrl = value === "" ? null : value;
  }
  return out;
}

// search, category, from/to and paging for GET /api/events and /admin/all.
// Paging is only used when page or limit was sent.
function listOptions(req) {
  const { search, category, from, to, page, limit } = req.query;
  const options = {};

  if (search !== undefined) options.search = String(search);
  if (category !== undefined) options.category = String(category);
  if (from !== undefined) options.from = parseDate(from, "from");
  if (to !== undefined) options.to = parseDate(to, "to");

  if (page !== undefined || limit !== undefined) {
    const pageNum = page === undefined ? 1 : Number(page);
    const limitNum = limit === undefined ? 20 : Number(limit);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      throw httpError(400, "page must be a whole number of 1 or more");
    }
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 50) {
      throw httpError(400, "limit must be a whole number between 1 and 50");
    }
    options.page = pageNum;
    options.limit = limitNum;
  }
  return options;
}

// { events, total }, plus page and limit when paging was used.
async function sendList(res, options) {
  const { events, total } = await Event.list(options);
  const body = { events, total };
  if (options.limit !== undefined) {
    body.page = options.page;
    body.limit = options.limit;
  }
  res.json(body);
}

// GET /api/events  (public)  Published events only, earliest first.
router.get("/", async (req, res) => {
  await sendList(res, listOptions(req));
});

// GET /api/events/admin/all  (ADMIN, SUPER_ADMIN)  Drafts and cancelled too.
// Declared before /:id so "admin" is never read as an event id.
router.get("/admin/all", ...adminOnly, async (req, res) => {
  await sendList(res, { ...listOptions(req), onlyPublished: false });
});

// GET /api/events/:id  (public)  Drafts are 404 unless an admin asks.
router.get("/:id", optionalAuth, async (req, res) => {
  checkId(req);
  const isAdmin = req.user && (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN");
  const event = await Event.findById(req.params.id, { publicOnly: !isAdmin });
  if (!event) throw httpError(404, "Event not found");
  res.json({ event });
});

// POST /api/events  { title, description?, venue, startsAt, endsAt, capacity, status?, category?, tags?, imageUrl? }  (ADMIN, SUPER_ADMIN)
router.post("/", ...adminOnly, async (req, res) => {
  const body = req.body || {};
  if (body.status !== undefined && body.status !== "DRAFT" && body.status !== "PUBLISHED") {
    throw httpError(400, "New events can only be created as DRAFT or PUBLISHED");
  }

  const data = validate(body, true);
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

  const registered = current.registeredCount || 0;

  if (changes.status && changes.status !== current.status) {
    if (!(MOVES[current.status] || []).includes(changes.status)) {
      throw httpError(409, `Cannot move an event from ${current.status} to ${changes.status}`);
    }
    if (changes.status === "DRAFT" && registered > 0) {
      throw httpError(409, "This event has registrations. Cancel it instead of moving it back to draft");
    }
  }

  if (changes.capacity !== undefined && changes.capacity < registered) {
    throw httpError(409, `${registered} people are already registered, so capacity cannot be lower`);
  }

  res.json({ event: await Event.update(req.params.id, changes) });
});

// DELETE /api/events/:id  (ADMIN, SUPER_ADMIN)  Drafts only.
router.delete("/:id", ...adminOnly, async (req, res) => {
  checkId(req);
  const current = await Event.findById(req.params.id);
  if (!current) throw httpError(404, "Event not found");
  if (current.status !== "DRAFT") {
    throw httpError(409, "Only draft events can be deleted. Cancel the event instead");
  }
  await Event.remove(req.params.id);
  res.status(204).end();
});

// What each Registration.register result means for the caller.
const REGISTER_ERRORS = {
  EVENT_NOT_FOUND: [404, "Event not found"],
  EVENT_CANCELLED: [409, "This event has been cancelled"],
  EVENT_ENDED: [409, "This event has already ended"],
  ALREADY_REGISTERED: [409, "You are already registered for this event"],
  EVENT_FULL: [409, "This event is full"],

};

// POST /api/events/:id/register  (any logged-in user)
router.post("/:id/register", verifyToken, async (req, res) => {
  checkId(req);
  const { result, registration } = await Registration.register(req.params.id, req.user.id);
  if (result !== "OK") throw httpError(...REGISTER_ERRORS[result]);

  // The RSVP is already saved. A notification problem must never fail it.
  try {
    const event = await Event.findById(req.params.id);
    await Notification.create({
      userId: req.user.id,
      eventId: req.params.id,
      message: `You are registered for ${event ? event.title : "an event"}`,
    });
  } catch (err) {
    console.warn("Could not create registration notification:", err.message);
  }

  res.status(201).json({ registration });
});

// DELETE /api/events/:id/register  (cancels your own registration)
router.delete("/:id/register", verifyToken, async (req, res) => {
  checkId(req);
  if (!(await Registration.cancel(req.params.id, req.user.id))) {
    throw httpError(404, "You are not registered for this event");
  }
  res.status(204).end();
});

// GET /api/events/:id/registrations  (ADMIN, SUPER_ADMIN)  Who is attending.
router.get("/:id/registrations", ...adminOnly, async (req, res) => {
  checkId(req);
  if (!(await Event.findById(req.params.id))) throw httpError(404, "Event not found");
  res.json({ registrations: await Registration.listForEvent(req.params.id) });
});

// PATCH /api/events/:id/registrations/:registrationId  { attended: true }  (ADMIN, SUPER_ADMIN)
router.patch("/:id/registrations/:registrationId", ...adminOnly, async (req, res) => {
  checkId(req);
  checkRegistrationId(req);
  const attended = (req.body || {}).attended;
  if (typeof attended !== "boolean") {
    throw httpError(400, "attended must be true or false");
  }
  if (!(await Event.findById(req.params.id))) throw httpError(404, "Event not found");

  const registration = await Registration.setAttendance(
    req.params.registrationId,
    req.params.id,
    attended
  );
  if (!registration) throw httpError(404, "Registration not found");
  res.json({ registration });
});

module.exports = router;
