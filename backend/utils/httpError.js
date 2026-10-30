// Usage: throw httpError(403, "Not allowed");
module.exports = function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};
