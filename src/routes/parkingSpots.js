const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /parking-spots?regionId=&available=true - search spots
router.get('/', async (req, res) => {
    try {
        const { regionId, available } = req.query;

        let query = `
            SELECT s.id, s.spot_number, s.available, s.parking_region_id,
                   r.name AS region_name
            FROM parking_spot s
            JOIN parking_region r ON r.id = s.parking_region_id
            WHERE 1=1
        `;
        const params = [];

        if (regionId) {
            params.push(regionId);
            query += ` AND s.parking_region_id = $${params.length}`;
        }
        if (available !== undefined) {
            params.push(available === 'true');
            query += ` AND s.available = $${params.length}`;
        }

        query += ' ORDER BY r.name, s.spot_number';

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /parking-spots/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT s.*, r.name AS region_name
            FROM parking_spot s
            JOIN parking_region r ON r.id = s.parking_region_id
            WHERE s.id = $1
        `, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Parking spot not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /parking-spots
router.post('/', async (req, res) => {
    try {
        const { parking_region_id, spot_number } = req.body;
        if (!parking_region_id || !spot_number) {
            return res.status(400).json({ error: 'parking_region_id and spot_number are required' });
        }

        const { rows } = await pool.query(
            'INSERT INTO parking_spot (parking_region_id, spot_number) VALUES ($1, $2) RETURNING *',
            [parking_region_id, spot_number]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /parking-spots/:id/availability - update availability (called by parking service)
router.patch('/:id/availability', async (req, res) => {
    try {
        const { available } = req.body;
        if (typeof available !== 'boolean') {
            return res.status(400).json({ error: 'available (boolean) is required' });
        }

        const { rows } = await pool.query(
            'UPDATE parking_spot SET available = $1 WHERE id = $2 RETURNING *',
            [available, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Parking spot not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /parking-spots/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM parking_spot WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Parking spot not found' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
