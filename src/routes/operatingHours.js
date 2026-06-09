const express = require('express');
const pool = require('../db');
const router = express.Router();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * @openapi
 * /operating-hours:
 *   get:
 *     summary: List operating hours
 *     tags: [Operating Hours]
 *     parameters:
 *       - in: query
 *         name: regionId
 *         schema: { type: string, format: uuid }
 *         description: Filter by parking region
 *     responses:
 *       200:
 *         description: List of operating hours entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OperatingHours'
 */
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

/**
 * @openapi
 * /operating-hours:
 *   post:
 *     summary: Create an operating hours entry for a region
 *     tags: [Operating Hours]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parking_region_id, day_of_week, open_time, close_time]
 *             properties:
 *               parking_region_id: { type: string, format: uuid }
 *               day_of_week: { type: integer, minimum: 0, maximum: 6, description: '0=Sunday, 6=Saturday' }
 *               open_time: { type: string, example: '08:00:00' }
 *               close_time: { type: string, example: '20:00:00' }
 *     responses:
 *       201:
 *         description: Created entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OperatingHours'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /operating-hours/{id}:
 *   put:
 *     summary: Update operating hours entry
 *     tags: [Operating Hours]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [open_time, close_time]
 *             properties:
 *               open_time: { type: string, example: '08:00:00' }
 *               close_time: { type: string, example: '20:00:00' }
 *     responses:
 *       200:
 *         description: Updated entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OperatingHours'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /operating-hours/{id}:
 *   delete:
 *     summary: Delete an operating hours entry
 *     tags: [Operating Hours]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
