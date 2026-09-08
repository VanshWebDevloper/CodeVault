const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const databasePath = path.join(__dirname, "..", "database", "codevault.db");
const schemaPath = path.join(__dirname, "..", "database", "schema.sql");

const databaseReady = (async () => {
  try {
    const SQL = await initSqlJs({
      locateFile: (file) =>
        path.join(__dirname, "..", "node_modules", "sql.js", "dist", file),
    });

    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    const db = fs.existsSync(databasePath)
      ? new SQL.Database(
          new Uint8Array(fs.readFileSync(databasePath))
        )
      : new SQL.Database();

    const schema = fs.readFileSync(schemaPath, "utf8");

    db.exec(schema);

    // Save the database to codevault.db
    fs.writeFileSync(databasePath, Buffer.from(db.export()));

    console.log("🗄️ Database connected");
    console.log("✅ Database initialized");

    return db;
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    throw error;
  }
})();

module.exports = databaseReady;
