require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const migrate = require('./migrate');
const authMiddleware = require('./middleware/auth');
const { connect } = require('./messaging');

const parkingRegionsRouter = require('./routes/parkingRegions');
const pricingRouter = require('./routes/pricing');
const operatingHoursRouter = require('./routes/operatingHours');

const app = express();
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/openapi.json', (req, res) => res.json(swaggerSpec));

app.use('/parking-regions', authMiddleware, parkingRegionsRouter);
app.use('/pricing', authMiddleware, pricingRouter);
app.use('/operating-hours', authMiddleware, operatingHoursRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8081;

migrate()
    .then(() => {
        connect();
        app.listen(PORT, () => console.log(`Parking-spots service running on port ${PORT}`));
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
