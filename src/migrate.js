const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id      SERIAL PRIMARY KEY,
                name    TEXT NOT NULL UNIQUE,
                run_at  TIMESTAMP DEFAULT NOW()
            )
        `);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

        for (const file of files) {
            const { rows } = await client.query('SELECT 1 FROM migrations WHERE name = $1', [file]);
            if (rows.length > 0) continue;

            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            console.log(`Ran migration: ${file}`);
        }
    } finally {
        client.release();
    }
}

module.exports = migrate;
