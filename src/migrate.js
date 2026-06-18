const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT pg_try_advisory_lock(20250618) AS locked');
        if (!rows[0].locked) {
            console.log('Migration lock not acquired — another instance is migrating, skipping.');
            return;
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id      SERIAL PRIMARY KEY,
                name    TEXT NOT NULL UNIQUE,
                run_at  TIMESTAMP DEFAULT NOW()
            )
        `);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

        for (const file of files) {
            const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
            if (rows.length > 0) continue;

            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            console.log(`Ran migration: ${file}`);
        }
    } finally {
        client.release();
    }
}

module.exports = migrate;
