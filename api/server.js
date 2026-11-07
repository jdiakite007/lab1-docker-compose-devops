const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "32kb" }));

const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 3000,
  max: 10
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (_error) {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get("/users", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users ORDER BY id"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/users", async (req, res, next) => {
  const { name, email } = req.body || {};

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    name.trim().length < 1 ||
    name.trim().length > 100 ||
    email.trim().length < 3 ||
    email.trim().length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      error: "Données invalides : name (1-100 caractères) et email valide requis."
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
      [name.trim(), email.trim().toLowerCase()]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Cette adresse e-mail existe déjà." });
    }
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  // Ne pas renvoyer les détails internes ou les identifiants de connexion au client.
  console.error("Erreur API :", error.message);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`API démarrée sur le port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} reçu : arrêt de l'API...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
