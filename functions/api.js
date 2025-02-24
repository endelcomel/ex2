const express = require('express');
const serverless = require('serverless-http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const app = express();
const router = express.Router();

// Middleware
app.use(express.json());

// Folder tempat database disimpan
const DATABASE_FOLDER = path.join(process.cwd(), 'public');

// Cache untuk menyimpan file database yang sudah didekompresi
const decompressedCache = {};

// Fungsi untuk mendapatkan daftar file database secara otomatis
function getDatabaseFiles() {
    try {
        const files = fs.readdirSync(DATABASE_FOLDER);
        return files
            .filter(file => file.endsWith('.sqlite3.gz'))
            .map(file => path.join(DATABASE_FOLDER, file));
    } catch (err) {
        console.error('Error reading database folder:', err.message);
        return [];
    }
}

// Fungsi untuk mendekompresi file gzip
function decompressFile(filePath, callback) {
    if (decompressedCache[filePath]) {
        return callback(null, decompressedCache[filePath]);
    }

    const gzip = zlib.createGunzip();
    const input = fs.createReadStream(filePath);
    const output = [];

    input.pipe(gzip)
        .on('data', (chunk) => output.push(chunk))
        .on('end', () => {
            const decompressedData = Buffer.concat(output);
            decompressedCache[filePath] = decompressedData;
            callback(null, decompressedData);
        })
        .on('error', (err) => {
            console.error(`Error decompressing file ${filePath}:`, err.message);
            callback(err);
        });
}

// Endpoint GET untuk mengakses data berdasarkan database_id
router.get('/:database_id', (req, res) => {
    const databaseId = req.params.database_id;
    const databases = getDatabaseFiles();

    if (databases.length === 0) {
        return res.status(404).json({ error: 'No databases found' });
    }

    let found = false;

    databases.forEach((dbPath, index) => {
        decompressFile(dbPath, (err, decompressedData) => {
            if (err) {
                console.error(`Error decompressing database ${dbPath}:`, err.message);
                return;
            }

            const tempFilePath = `${dbPath}.tmp`;
            fs.writeFileSync(tempFilePath, decompressedData);

            const db = new sqlite3.Database(tempFilePath, (err) => {
                if (err) {
                    console.error(`Error opening database ${tempFilePath}:`, err.message);
                    fs.unlinkSync(tempFilePath);
                    return;
                }

                const query = 'SELECT * FROM questions WHERE database_id = ?';
                db.get(query, [databaseId], (err, row) => {
                    if (err) {
                        console.error(`Error executing query on database ${tempFilePath}:`, err.message);
                        db.close(() => fs.unlinkSync(tempFilePath));
                        return;
                    }

                    if (row) {
                        found = true;
                        res.json(row);
                        db.close(() => fs.unlinkSync(tempFilePath));
                    } else {
                        db.close(() => fs.unlinkSync(tempFilePath));
                    }

                    if (index === databases.length - 1 && !found) {
                        res.status(404).json({ error: 'Database ID not found in any database' });
                    }
                });
            });
        });
    });
});

// Gunakan router
app.use('/.netlify/functions/api', router);

// Ekspor handler serverless
module.exports.handler = serverless(app);
