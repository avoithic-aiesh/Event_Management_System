const router = require("express").Router();

router.use("/health", require("./health"));
router.use("/auth", require("./auth"));
router.use("/users", require("./users"));
router.use("/events", require("./events"));

module.exports = router;
