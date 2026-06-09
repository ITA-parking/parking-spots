const express = require('express');
const pool = require('../db');
const router = express.Router();

/**
 * @openapi
 * /parking-spots:
 *   get:
 *     summary: Search parking spots
 *     tags: [Parking Spots]
 *     parameters:
 *       - in: query
 *         name: regionId
 *         schema: { type: string, format: uuid }
 *         description: Filter by parking region
 *       - in: query
 *         name: available
 *         schema: { type: boolean }
 *         description: Filter by availability
 *     responses:
 *       200:
 *         description: List of parking spots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ParkingSpot'
 */
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

/**
 * @openapi
 * /parking-spots/{id}:
 *   get:
 *     summary: Get a parking spot by ID
 *     tags: [Parking Spots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Parking spot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParkingSpot'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /parking-spots:
 *   post:
 *     summary: Create a new parking spot
 *     tags: [Parking Spots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parking_region_id, spot_number]
 *             properties:
 *               parking_region_id: { type: string, format: uuid }
 *               spot_number: { type: string }
 *     responses:
 *       201:
 *         description: Created spot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParkingSpot'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /parking-spots/{id}/availability:
 *   patch:
 *     summary: Update availability of a parking spot
 *     description: Called by the parking service when a session starts or ends.
 *     tags: [Parking Spots]
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
 *             required: [available]
 *             properties:
 *               available: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated spot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParkingSpot'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /parking-spots/{id}:
 *   delete:
 *     summary: Delete a parking spot
 *     tags: [Parking Spots]
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
        const { rowCount } = await pool.query('DELETE FROM parking_spot WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Parking spot not found' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
