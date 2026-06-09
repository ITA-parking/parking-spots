const express = require('express');
const pool = require('../db');
const router = express.Router();

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
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                r.id, r.name, r.description,
                p.price_per_hour, p.currency
            FROM parking_region r
            LEFT JOIN pricing p ON p.parking_region_id = r.id
                AND p.valid_from <= CURRENT_DATE
                AND (p.valid_to IS NULL OR p.valid_to >= CURRENT_DATE)
            ORDER BY r.name
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
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
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const regionRes = await pool.query('SELECT * FROM parking_region WHERE id = $1', [id]);
        if (regionRes.rows.length === 0) return res.status(404).json({ error: 'Region not found' });

        const pricingRes = await pool.query(`
            SELECT id, price_per_hour, currency, valid_from, valid_to
            FROM pricing
            WHERE parking_region_id = $1
              AND valid_from <= CURRENT_DATE
              AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
        `, [id]);

        const hoursRes = await pool.query(`
            SELECT id, day_of_week, open_time, close_time
            FROM operating_hours
            WHERE parking_region_id = $1
            ORDER BY day_of_week
        `, [id]);

        res.json({
            ...regionRes.rows[0],
            pricing: pricingRes.rows[0] || null,
            operating_hours: hoursRes.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
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
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });

        const { rows } = await pool.query(
            'INSERT INTO parking_region (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
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
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });

        const { rows } = await pool.query(
            `UPDATE parking_region SET name = $1, description = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [name, description || null, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Region not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
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
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM parking_region WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Region not found' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
