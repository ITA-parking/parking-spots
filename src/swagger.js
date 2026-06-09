const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Parking Spots Service',
            version: '1.0.0',
            description: 'Search available parking spots, prices and operating hours',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                ParkingRegion: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                    },
                },
                ParkingRegionDetail: {
                    allOf: [
                        { $ref: '#/components/schemas/ParkingRegion' },
                        {
                            type: 'object',
                            properties: {
                                pricing: { $ref: '#/components/schemas/Pricing', nullable: true },
                                operating_hours: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/OperatingHours' },
                                },
                            },
                        },
                    ],
                },
                Pricing: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        parking_region_id: { type: 'string', format: 'uuid' },
                        region_name: { type: 'string' },
                        price_per_hour: { type: 'number', format: 'float' },
                        currency: { type: 'string', example: 'EUR' },
                        valid_from: { type: 'string', format: 'date' },
                        valid_to: { type: 'string', format: 'date', nullable: true },
                    },
                },
                OperatingHours: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        parking_region_id: { type: 'string', format: 'uuid' },
                        day_of_week: { type: 'integer', minimum: 0, maximum: 6, description: '0=Sunday, 6=Saturday' },
                        day_name: { type: 'string', example: 'Monday' },
                        open_time: { type: 'string', example: '08:00:00' },
                        close_time: { type: 'string', example: '20:00:00' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
