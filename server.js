const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Connect to SQLite (creates file if not exists)
const db = new sqlite3.Database(path.join(__dirname, "database.db"), (err) => {
  if (err) console.error("Error connecting to database:", err.message);
  else console.log("Connected to SQLite database");
});

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL,
  category TEXT,
  type TEXT,
  date TEXT,
  note TEXT
)`);

// Get all transactions
app.get("/api/transactions", (req, res) => {
  db.all("SELECT * FROM transactions ORDER BY date DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add transaction
app.post("/api/transactions", (req, res) => {
  const { amount, category, type, date, note } = req.body;
  db.run(
    "INSERT INTO transactions (amount, category, type, date, note) VALUES (?, ?, ?, ?, ?)",
    [amount, category, type, date, note],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Delete transaction
app.delete("/api/transactions/:id", (req, res) => {
  db.run("DELETE FROM transactions WHERE id = ?", req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});