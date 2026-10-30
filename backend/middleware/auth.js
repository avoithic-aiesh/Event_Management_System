const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const httpError = require("../utils/httpError");

// Step 1: who are you? Reads the token and loads the user into req.user.
// The user is loaded from the database each time, so a suspended account stops working at once.
async function verifyToken(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw httpError(401, "Login required");

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw httpError(401, "Invalid or expired token");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "ACTIVE")
    throw httpError(401, "Account not available");

  req.user = user;
  next();
}

// Step 2: are you allowed? Use after verifyToken.
// Example: router.get("/", verifyToken, authorizeRoles("ADMIN", "SUPER_ADMIN"), handler);
function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw httpError(403, "You do not have permission to do this");
    }
    next();
  };
}

module.exports = { verifyToken, authorizeRoles };
