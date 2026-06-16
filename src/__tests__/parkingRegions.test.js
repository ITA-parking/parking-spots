jest.mock('../db');
jest.mock('../messaging', () => ({
    connect: jest.fn(),
    publishEvent: jest.fn(() => ({ pipe: () => ({}) })),
}));
jest.mock('../middleware/auth', () => (req, res, next) => next());

const request = require('supertest');
const express = require('express');
const pool = require('../db');
const { publishEvent } = require('../messaging');
const parkingRegionsRouter = require('../routes/parkingRegions');

const { from } = require('rxjs');

const app = express();
app.use(express.json());
app.use('/parking-regions', parkingRegionsRouter);

describe('GET /parking-regions', () => {
    it('returns 200 with list of regions', async () => {
        pool.query.mockResolvedValueOnce({ rows: [
            { id: '1', name: 'City Center', price_per_hour: 2.5, currency: 'EUR' },
            { id: '2', name: 'Airport', price_per_hour: 5.0, currency: 'EUR' },
        ]});

        const res = await request(app).get('/parking-regions');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].name).toBe('City Center');
    });
});

describe('GET /parking-regions/:id', () => {
    it('returns 200 with region detail', async () => {
        const regionId = 'abc-123';
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: regionId, name: 'City Center' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'p1', price_per_hour: 2.5, currency: 'EUR' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'h1', day_of_week: 1, open_time: '08:00', close_time: '20:00' }] });

        const res = await request(app).get(`/parking-regions/${regionId}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(regionId);
        expect(res.body.pricing).toBeDefined();
        expect(res.body.operating_hours).toHaveLength(1);
    });

    it('returns 404 when region does not exist', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/parking-regions/nonexistent-id');
        expect(res.status).toBe(404);
    });
});

describe('POST /parking-regions', () => {
    it('returns 201 with created region', async () => {
        const created = { id: 'new-id', name: 'New Region', description: null };
        pool.query.mockResolvedValueOnce({ rows: [created] });
        publishEvent.mockReturnValueOnce(from(Promise.resolve()));

        const res = await request(app)
            .post('/parking-regions')
            .send({ name: 'New Region' });
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('New Region');
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/parking-regions')
            .send({});
        expect(res.status).toBe(400);
    });
});

describe('PUT /parking-regions/:id', () => {
    it('returns 200 with updated region', async () => {
        const updated = { id: 'r1', name: 'Updated Name', updated_at: new Date().toISOString() };
        pool.query.mockResolvedValueOnce({ rows: [updated] });
        publishEvent.mockReturnValueOnce(from(Promise.resolve()));

        const res = await request(app)
            .put('/parking-regions/r1')
            .send({ name: 'Updated Name' });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Name');
    });

    it('returns 404 when region not found', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const res = await request(app)
            .put('/parking-regions/nonexistent')
            .send({ name: 'Updated Name' });
        expect(res.status).toBe(404);
    });
});

describe('DELETE /parking-regions/:id', () => {
    it('returns 204 on success', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'r1' }] });
        publishEvent.mockReturnValueOnce(from(Promise.resolve()));

        const res = await request(app).delete('/parking-regions/r1');
        expect(res.status).toBe(204);
    });

    it('returns 404 when region not found', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

        const res = await request(app).delete('/parking-regions/nonexistent');
        expect(res.status).toBe(404);
    });
});
