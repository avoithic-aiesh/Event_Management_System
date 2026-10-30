const env = require("../config/env");

function notFound(_req, res) {
  res.status(404).json({ message: "Route not found" });
}

// Express recognises an error handler by its 4 arguments. Keep all 4.
function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;

  if (status >= 500) {
    console.error(err);
    // Do not leak internal details to users in production.
    const message =
      env.NODE_ENV === "production" ? "Something went wrong" : err.message;
    return res.status(status).json({ message });
  }
  res.status(status).json({ message: err.message });
}

module.exports = { notFound, errorHandler };
