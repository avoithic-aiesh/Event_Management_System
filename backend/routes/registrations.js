const router = require("express").Router();
const Registration = require("../models/Registration");
const { verifyToken } = require("../middleware/auth");

// GET /api/registrations/me  (any logged-in user)  The events you signed up for.
router.get("/me", verifyToken, async (req, res) => {
  res.json({ registrations: await Registration.listForUser(req.user.id) });
});

module.exports = router;
