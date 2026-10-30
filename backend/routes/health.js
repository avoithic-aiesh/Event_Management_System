const router = require("express").Router();

router.get("/", (_req, res) => {
  res.json({ status: "OK" });
});

module.exports = router;
