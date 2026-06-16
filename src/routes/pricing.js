const express = require('express');
const { from } = require('rxjs');
const { map, catchError } = require('rxjs/operators');
const pool = require('../db');
const router = express.Router();

const query$ = (sql, params) => from(pool.query(sql, params));

/**
 * @openapi
 * /pricing:
 *   get:
 *     summary: List pricing entries
 *     tags: [Pricing]
 *     parameters:
 *       - in: query
 *         name: regionId
 *         schema: { type: string, format: uuid }
 *         description: Filter by parking region
 *     responses:
 *       200:
 *         description: List of pricing entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pricing'
 */
router.get('/', (req, res) => {
    const { regionId } = req.query;
    let sql = `
        SELECT p.*, r.name AS region_name
        FROM pricing p
        JOIN parking_region r ON r.id = p.parking_region_id
        WHERE 1=1
    `;
    const params = [];
    if (regionId) {
        params.push(regionId);
        sql += ` AND p.parking_region_id = $${params.length}`;
    }
    sql += ' ORDER BY p.valid_from DESC';

    query$(sql, params).pipe(
        map(result => result.rows),
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
 * /pricing:
 *   post:
 *     summary: Create a pricing entry for a region
 *     tags: [Pricing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parking_region_id, price_per_hour, valid_from]
 *             properties:
 *               parking_region_id: { type: string, format: uuid }
 *               price_per_hour: { type: number, format: float }
 *               currency: { type: string, default: EUR }
 *               valid_from: { type: string, format: date }
 *               valid_to: { type: string, format: date, nullable: true }
 *     responses:
 *       201:
 *         description: Created pricing entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pricing'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (req, res) => {
    const { parking_region_id, price_per_hour, currency, valid_from, valid_to } = req.body;
    if (!parking_region_id || price_per_hour == null || !valid_from) {
        return res.status(400).json({ error: 'parking_region_id, price_per_hour and valid_from are required' });
    }

    query$(
        `INSERT INTO pricing (parking_region_id, price_per_hour, currency, valid_from, valid_to)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [parking_region_id, price_per_hour, currency || 'EUR', valid_from, valid_to || null]
    ).pipe(
        map(result => result.rows[0]),
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
 * /pricing/{id}:
 *   delete:
 *     summary: Delete a pricing entry
 *     tags: [Pricing]
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
    query$('DELETE FROM pricing WHERE id = $1', [req.params.id]).pipe(
        map(result => result.rowCount),
    ).subscribe({
        next: count => {
            if (count === 0) return res.status(404).json({ error: 'Pricing entry not found' });
            res.status(204).send();
        },
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
});

module.exports = router;
