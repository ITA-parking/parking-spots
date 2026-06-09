const express = require('express');
const pool = require('../db');
const router = express.Router();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GET /operating-hours?regionId=
router.get('/', async (req, res) => {
    try {
        const { regionId } = req.query;
        let query = `
            SELECT oh.*, r.name AS region_name
            FROM operating_hours oh
            JOIN parking_region r ON r.id = oh.parking_region_id
            WHERE 1=1
        `;
        const params = [];
        if (regionId) {
            params.push(regionId);
            query += ` AND oh.parking_region_id = $${params.length}`;
        }
        query += ' ORDER BY oh.day_of_week';

        const { rows } = await pool.query(query, params);
        res.json(rows.map(r => ({ ...r, day_name: DAY_NAMES[r.day_of_week] })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /operating-hours
router.post('/', async (req, res) => {
    try {
        const { parking_region_id, day_of_week, open_time, close_time } = req.body;
        if (!parking_region_id || day_of_week == null || !open_time || !close_time) {
            return res.status(400).json({ error: 'parking_region_id, day_of_week, open_time and close_time are required' });
        }
        if (day_of_week < 0 || day_of_week > 6) {
            return res.status(400).json({ error: 'day_of_week must be 0 (Sunday) to 6 (Saturday)' });
        }

        const { rows } = await pool.query(
            `INSERT INTO operating_hours (parking_region_id, day_of_week, open_time, close_time)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [parking_region_id, day_of_week, open_time, close_time]
        );
        res.status(201).json({ ...rows[0], day_name: DAY_NAMES[rows[0].day_of_week] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /operating-hours/:id
router.put('/:id', async (req, res) => {
    try {
        const { open_time, close_time } = req.body;
        if (!open_time || !close_time) {
            return res.status(400).json({ error: 'open_time and close_time are required' });
        }

        const { rows } = await pool.query(
            'UPDATE operating_hours SET open_time = $1, close_time = $2 WHERE id = $3 RETURNING *',
            [open_time, close_time, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Operating hours entry not found' });
        res.json({ ...rows[0], day_name: DAY_NAMES[rows[0].day_of_week] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /operating-hours/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM operating_hours WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Operating hours entry not found' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
