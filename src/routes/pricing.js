const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /pricing?regionId= - list pricing for a region
router.get('/', async (req, res) => {
    try {
        const { regionId } = req.query;
        let query = `
            SELECT p.*, r.name AS region_name
            FROM pricing p
            JOIN parking_region r ON r.id = p.parking_region_id
            WHERE 1=1
        `;
        const params = [];
        if (regionId) {
            params.push(regionId);
            query += ` AND p.parking_region_id = $${params.length}`;
        }
        query += ' ORDER BY p.valid_from DESC';

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /pricing
router.post('/', async (req, res) => {
    try {
        const { parking_region_id, price_per_hour, currency, valid_from, valid_to } = req.body;
        if (!parking_region_id || price_per_hour == null || !valid_from) {
            return res.status(400).json({ error: 'parking_region_id, price_per_hour and valid_from are required' });
        }

        const { rows } = await pool.query(
            `INSERT INTO pricing (parking_region_id, price_per_hour, currency, valid_from, valid_to)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [parking_region_id, price_per_hour, currency || 'EUR', valid_from, valid_to || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /pricing/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM pricing WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Pricing entry not found' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
