const express = require('express');
const { from, forkJoin } = require('rxjs');
const { map, switchMap, catchError } = require('rxjs/operators');
const pool = require('../db');
const { publishEvent } = require('../messaging');
const router = express.Router();

const query$ = (sql, params) => from(pool.query(sql, params));

/**
 * @openapi
 * /parking-regions:
 *   get:
 *     summary: List all parking regions with current pricing
 *     tags: [Parking Regions]
 *     responses:
 *       200:
 *         description: List of regions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/ParkingRegion'
 *                   - type: object
 *                     properties:
 *                       price_per_hour: { type: number }
 *                       currency: { type: string }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', (req, res) => {
    query$(`
        SELECT
            r.id, r.name, r.description,
            p.price_per_hour, p.currency
        FROM parking_region r
        LEFT JOIN pricing p ON p.parking_region_id = r.id
            AND p.valid_from <= CURRENT_DATE
            AND (p.valid_to IS NULL OR p.valid_to >= CURRENT_DATE)
        ORDER BY r.name
    `).pipe(
        map(result => result.rows),
        catchError(err => { throw err; })
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
 * /parking-regions/{id}:
 *   get:
 *     summary: Get a parking region with current pricing and operating hours
 *     tags: [Parking Regions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Region detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParkingRegionDetail'
 *       404:
 *         description: Region not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', (req, res) => {
    const { id } = req.params;

    query$('SELECT * FROM parking_region WHERE id = $1', [id]).pipe(
        switchMap(regionRes => {
            if (regionRes.rows.length === 0) {
                res.status(404).json({ error: 'Region not found' });
                return [];
            }
            return forkJoin({
                region: from(Promise.resolve(regionRes.rows[0])),
                pricing: query$(`
                    SELECT id, price_per_hour, currency, valid_from, valid_to
                    FROM pricing
                    WHERE parking_region_id = $1
                      AND valid_from <= CURRENT_DATE
                      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                `, [id]).pipe(map(r => r.rows[0] || null)),
                hours: query$(`
                    SELECT id, day_of_week, open_time, close_time
                    FROM operating_hours
                    WHERE parking_region_id = $1
                    ORDER BY day_of_week
                `, [id]).pipe(map(r => r.rows)),
            });
        }),
        map(data => data && ({ ...data.region, pricing: data.pricing, operating_hours: data.hours })),
    ).subscribe({
        next: result => result && res.json(result),
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
});

/**
 * @openapi
 * /parking-regions:
 *   post:
 *     summary: Create a new parking region
 *     tags: [Parking Regions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Created region
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParkingRegion'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    query$(
        'INSERT INTO parking_region (name, description) VALUES ($1, $2) RETURNING *',
        [name, description || null]
    ).pipe(
        map(result => result.rows[0]),
        switchMap(region =>
            publishEvent('/topic/parking-spots.created', { event: 'region.created', data: region }).pipe(
                map(() => region)
            )
        ),
    ).subscribe({
        next: region => res.status(201).json(region),
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
});

/**
 * @openapi
 * /parking-regions/{id}:
 *   put:
 *     summary: Update a parking region
 *     tags: [Parking Regions]
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated region
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParkingRegion'
 *       404:
 *         description: Region not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    query$(
        `UPDATE parking_region SET name = $1, description = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [name, description || null, id]
    ).pipe(
        switchMap(result => {
            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Region not found' });
                return [];
            }
            const region = result.rows[0];
            return publishEvent('/topic/parking-spots.updated', { event: 'region.updated', data: region }).pipe(
                map(() => region)
            );
        }),
    ).subscribe({
        next: region => region && res.json(region),
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
});

/**
 * @openapi
 * /parking-regions/{id}:
 *   delete:
 *     summary: Delete a parking region
 *     tags: [Parking Regions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Region not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', (req, res) => {
    const { id } = req.params;

    query$('DELETE FROM parking_region WHERE id = $1 RETURNING id', [id]).pipe(
        switchMap(result => {
            if (result.rowCount === 0) {
                res.status(404).json({ error: 'Region not found' });
                return [];
            }
            return publishEvent('/topic/parking-spots.deleted', { event: 'region.deleted', data: { id } });
        }),
    ).subscribe({
        next: () => res.headersSent || res.status(204).send(),
        error: err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        },
    });
});

module.exports = router;
