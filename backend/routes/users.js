const router = require("express").Router();
const User = require("../models/User");
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const httpError = require("../utils/httpError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/users  (ADMIN and SUPER_ADMIN)
router.get("/", verifyToken, authorizeRoles("ADMIN", "SUPER_ADMIN"), async (_req, res) => {
  res.json({ users: await User.list() });
});

// PATCH /api/users/:id/role  { role }  (SUPER_ADMIN only)
router.patch("/:id/role", verifyToken, authorizeRoles("SUPER_ADMIN"), async (req, res) => {
  const { role } = req.body || {};

  if (!UUID_RE.test(req.params.id)) throw httpError(400, "Invalid user id");
  if (!User.ROLES.includes(role)) throw httpError(400, `Role must be one of: ${User.ROLES.join(", ")}`);
  if (req.params.id === req.user.id) throw httpError(400, "You cannot change your own role");

  const user = await User.updateRole(req.params.id, role);
  if (!user) throw httpError(404, "User not found");
  res.json({ user });
});

module.exports = router;
