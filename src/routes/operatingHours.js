const express = require('express');
const { from } = require('rxjs');
const { map } = require('rxjs/operators');
const pool = require('../db');
const router = express.Router();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const query$ = (sql, params) => from(pool.query(sql, params));

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
router.get('/', (req, res) => {
    const { regionId } = req.query;
    let sql = `
        SELECT oh.*, r.name AS region_name
        FROM operating_hours oh
        JOIN parking_region r ON r.id = oh.parking_region_id
        WHERE 1=1
    `;
    const params = [];
    if (regionId) {
        params.push(regionId);
        sql += ` AND oh.parking_region_id = $${params.length}`;
    }
    sql += ' ORDER BY oh.day_of_week';

    query$(sql, params).pipe(
        map(result => result.rows.map(r => ({ ...r, day_name: DAY_NAMES[r.day_of_week] }))),
    ).subscribe({
        next: rows => res.json(rows),
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
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
router.post('/', (req, res) => {
    const { parking_region_id, day_of_week, open_time, close_time } = req.body;
    if (!parking_region_id || day_of_week == null || !open_time || !close_time) {
        return res.status(400).json({ error: 'parking_region_id, day_of_week, open_time and close_time are required' });
    }
    if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json({ error: 'day_of_week must be 0 (Sunday) to 6 (Saturday)' });
    }

    query$(
        `INSERT INTO operating_hours (parking_region_id, day_of_week, open_time, close_time)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [parking_region_id, day_of_week, open_time, close_time]
    ).pipe(
        map(result => ({ ...result.rows[0], day_name: DAY_NAMES[result.rows[0].day_of_week] })),
    ).subscribe({
        next: row => res.status(201).json(row),
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
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
router.put('/:id', (req, res) => {
    const { open_time, close_time } = req.body;
    if (!open_time || !close_time) {
        return res.status(400).json({ error: 'open_time and close_time are required' });
    }

    query$(
        'UPDATE operating_hours SET open_time = $1, close_time = $2 WHERE id = $3 RETURNING *',
        [open_time, close_time, req.params.id]
    ).pipe(
        map(result => {
            if (result.rows.length === 0) return null;
            return { ...result.rows[0], day_name: DAY_NAMES[result.rows[0].day_of_week] };
        }),
    ).subscribe({
        next: row => {
            if (!row) return res.status(404).json({ error: 'Operating hours entry not found' });
            res.json(row);
        },
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
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
router.delete('/:id', (req, res) => {
    query$('DELETE FROM operating_hours WHERE id = $1', [req.params.id]).pipe(
        map(result => result.rowCount),
    ).subscribe({
        next: count => {
            if (count === 0) return res.status(404).json({ error: 'Operating hours entry not found' });
            res.status(204).send();
        },
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
});

module.exports = router;
