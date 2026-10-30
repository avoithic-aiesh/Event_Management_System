const { Pool } = require("pg");
const env = require("./env");

// One shared connection pool. Use db.query("SQL", [values]) everywhere.
module.exports = new Pool({ connectionString: env.DATABASE_URL });
