jest.mock('../db');
jest.mock('../middleware/auth', () => (req, res, next) => next());

const request = require('supertest');
const express = require('express');
const pool = require('../db');
const pricingRouter = require('../routes/pricing');

const app = express();
app.use(express.json());
app.use('/pricing', pricingRouter);

describe('GET /pricing', () => {
    it('returns 200 with list of pricing entries', async () => {
        pool.query.mockResolvedValueOnce({ rows: [
            { id: 'p1', price_per_hour: 2.5, currency: 'EUR', region_name: 'City Center' },
        ]});

        const res = await request(app).get('/pricing');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].currency).toBe('EUR');
    });

    it('returns empty array when no pricing exists', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/pricing');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

describe('POST /pricing', () => {
    it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
            .post('/pricing')
            .send({ currency: 'EUR' });
        expect(res.status).toBe(400);
    });

    it('returns 201 with created pricing entry', async () => {
        const entry = {
            id: 'p1', parking_region_id: 'r1',
            price_per_hour: 3.0, currency: 'EUR',
            valid_from: '2024-01-01', valid_to: null,
        };
        pool.query.mockResolvedValueOnce({ rows: [entry] });

        const res = await request(app)
            .post('/pricing')
            .send({
                parking_region_id: 'r1',
                price_per_hour: 3.0,
                valid_from: '2024-01-01',
            });
        expect(res.status).toBe(201);
        expect(res.body.price_per_hour).toBe(3.0);
        expect(res.body.currency).toBe('EUR');
    });
});

describe('DELETE /pricing/:id', () => {
    it('returns 204 on successful delete', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 1 });

        const res = await request(app).delete('/pricing/p1');
        expect(res.status).toBe(204);
    });

    it('returns 404 when pricing entry not found', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 0 });

        const res = await request(app).delete('/pricing/nonexistent');
        expect(res.status).toBe(404);
    });
});
