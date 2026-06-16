jest.mock('../db');
jest.mock('../middleware/auth', () => (req, res, next) => next());

const request = require('supertest');
const express = require('express');
const pool = require('../db');
const operatingHoursRouter = require('../routes/operatingHours');

const app = express();
app.use(express.json());
app.use('/operating-hours', operatingHoursRouter);

describe('GET /operating-hours', () => {
    it('returns 200 with list including day_name', async () => {
        pool.query.mockResolvedValueOnce({ rows: [
            { id: 'h1', parking_region_id: 'r1', day_of_week: 1, open_time: '08:00', close_time: '20:00', region_name: 'City' },
        ]});

        const res = await request(app).get('/operating-hours');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].day_name).toBe('Monday');
    });
});

describe('POST /operating-hours', () => {
    it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
            .post('/operating-hours')
            .send({ parking_region_id: 'r1' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when day_of_week is out of range', async () => {
        const res = await request(app)
            .post('/operating-hours')
            .send({
                parking_region_id: 'r1',
                day_of_week: 7,
                open_time: '08:00:00',
                close_time: '20:00:00',
            });
        expect(res.status).toBe(400);
    });

    it('returns 201 with day_name on success', async () => {
        const row = { id: 'h1', parking_region_id: 'r1', day_of_week: 6, open_time: '08:00:00', close_time: '20:00:00' };
        pool.query.mockResolvedValueOnce({ rows: [row] });

        const res = await request(app)
            .post('/operating-hours')
            .send({
                parking_region_id: 'r1',
                day_of_week: 6,
                open_time: '08:00:00',
                close_time: '20:00:00',
            });
        expect(res.status).toBe(201);
        expect(res.body.day_name).toBe('Saturday');
    });
});

describe('PUT /operating-hours/:id', () => {
    it('returns 400 when times are missing', async () => {
        const res = await request(app)
            .put('/operating-hours/h1')
            .send({});
        expect(res.status).toBe(400);
    });

    it('returns 404 when entry not found', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .put('/operating-hours/nonexistent')
            .send({ open_time: '09:00:00', close_time: '21:00:00' });
        expect(res.status).toBe(404);
    });

    it('returns 200 with updated entry', async () => {
        const row = { id: 'h1', day_of_week: 2, open_time: '09:00:00', close_time: '21:00:00' };
        pool.query.mockResolvedValueOnce({ rows: [row] });

        const res = await request(app)
            .put('/operating-hours/h1')
            .send({ open_time: '09:00:00', close_time: '21:00:00' });
        expect(res.status).toBe(200);
        expect(res.body.day_name).toBe('Tuesday');
    });
});

describe('DELETE /operating-hours/:id', () => {
    it('returns 204 on success', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 1 });

        const res = await request(app).delete('/operating-hours/h1');
        expect(res.status).toBe(204);
    });

    it('returns 404 when entry not found', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 0 });

        const res = await request(app).delete('/operating-hours/nonexistent');
        expect(res.status).toBe(404);
    });
});
