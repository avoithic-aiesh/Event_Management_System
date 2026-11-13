const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");
const httpError = require("../utils/httpError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/signup  { fullName, email, password }
// Public signup is always a MEMBER. The role is never read from the request.
router.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body || {};

  if (typeof fullName !== "string" || fullName.trim().length < 2) throw httpError(400, "Name is too short");
  if (typeof email !== "string" || !EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email");
  if (typeof password !== "string" || password.length < 8) {
    throw httpError(400, "Password must be at least 8 characters");
  }
  if (password.length > 72) throw httpError(400, "Password is too long");

  try {
    const user = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === "23505") throw httpError(409, "Email already registered"); // unique violation
    throw err;
  }
});

// POST /api/auth/login  { email, password }  ->  { token, user }
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    throw httpError(400, "Email and password are required");
  }

  const user = await User.findByEmail(email.toLowerCase());
  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));

  // Same message for "no such email" and "wrong password".
  if (!passwordOk) throw httpError(401, "Wrong email or password");
  if (user.status !== "ACTIVE") throw httpError(403, "Account suspended");

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  res.json({ token, user: User.toPublic(user) });
});

// GET /api/auth/me  (any logged-in user)
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
