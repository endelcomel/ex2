const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Path ke database
const dbPath1 = path.join(__dirname, "../public/db_1.sqlite3");
const dbPath2 = path.join(__dirname, "../public/db_2.sqlite3");

exports.handler = async (event, context) => {
  const { database_id } = event.queryStringParameters;

  if (!database_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing database_id parameter" }),
    };
  }

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
    return {
      statusCode: 200,
      body: JSON.stringify(result.length > 0 ? result : { message: "No data found" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
