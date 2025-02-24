const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Path ke database
const dbPath1 = path.join(__dirname, "../public/db_1.sqlite3");
const dbPath2 = path.join(__dirname, "../public/db_2.sqlite3");

// Endpoint untuk mencari data berdasarkan database_id
app.get("/api/data/:database_id", async (req, res) => {
  const { database_id } = req.params;

  try {
    // Buka koneksi ke kedua database
    const db1 = new sqlite3.Database(dbPath1);
    const db2 = new sqlite3.Database(dbPath2);

    // Query untuk mencari data
    const query = `
      SELECT * FROM questions WHERE database_id = ?
      UNION ALL
      SELECT * FROM questions WHERE database_id = ?
      LIMIT 1;
    `;

    // Jalankan query pada kedua database
    const result1 = await new Promise((resolve, reject) => {
      db1.all(query, [database_id, database_id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    const result2 = await new Promise((resolve, reject) => {
      db2.all(query, [database_id, database_id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    // Gabungkan hasil dari kedua database
    const result = [...result1, ...result2];

    // Tutup koneksi database
    db1.close();
    db2.close();

    // Kirim hasil ke frontend
    res.json(result.length > 0 ? result : { message: "No data found" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Jalankan server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});