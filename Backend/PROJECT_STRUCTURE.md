# Project Structure

## Overview
Server-side implementation for travel management system using Express.js with static test data.

## Directory Structure

```
project/
├── server/
│   ├── app.js                          # Main Express application
│   ├── config/
│   │   └── database.js                 # Database configuration (prepared for future use)
│   ├── data/                           # Static test data
│   │   ├── employees.js                # Employee and companion data
│   │   ├── hotels.js                   # Hotel, city, and pricing data
│   │   ├── roomTypes.js                # Room type configurations
│   │   └── transportAllowances.js      # Transport allowance options
│   ├── services/                       # Business logic layer
│   │   ├── employeeService.js          # Employee operations
│   │   ├── hotelService.js             # Hotel operations
│   │   ├── pricingService.js           # Pricing calculations
│   │   └── transportService.js         # Transport allowance operations
│   └── routes/                         # API route handlers
│       ├── employeeRoutes.js           # Employee endpoints
│       ├── hotelRoutes.js              # Hotel endpoints
│       ├── pricingRoutes.js            # Pricing endpoints
│       ├── roomTypeRoutes.js           # Room type endpoints
│       └── transportRoutes.js          # Transport endpoints
├── index.js                            # Application entry point
├── test-api.js                         # API testing script
├── package.json                        # Dependencies and scripts
├── API_DOCUMENTATION.md                # Complete API documentation
├── TEST_DATA.md                        # Test data documentation
└── PROJECT_STRUCTURE.md                # This file

```

## Components

### 1. Data Layer (`server/data/`)
Contains all static test data:
- **employees.js**: 3 sample employees with companions
- **hotels.js**: 23 hotels across 8 Egyptian cities with base prices
- **roomTypes.js**: 6 room types with pricing factors
- **transportAllowances.js**: Transport allowance options by city

### 2. Service Layer (`server/services/`)
Business logic for all operations:
- **employeeService.js**: Employee lookup and validation
- **hotelService.js**: Hotel search and configuration
- **pricingService.js**: Complex price calculations
- **transportService.js**: Transport allowance logic

### 3. Route Layer (`server/routes/`)
API endpoints organized by domain:
- **employeeRoutes.js**: 3 endpoints
- **hotelRoutes.js**: 4 endpoints
- **pricingRoutes.js**: 4 endpoints
- **roomTypeRoutes.js**: 2 endpoints
- **transportRoutes.js**: 2 endpoints

### 4. Configuration (`server/config/`)
- **database.js**: Prepared for database connection (not yet active)

### 5. Application Core
- **server/app.js**: Express server setup with middleware
- **index.js**: Entry point that loads the app

## API Endpoints Summary

Total: 15 endpoints across 5 domains

### Hotels (4 endpoints)
- GET `/api/cities`
- GET `/api/hotels/:city`
- GET `/api/hotel/:hotelId`
- GET `/api/hotel/:hotelId/extra-beds`

### Employees (3 endpoints)
- GET `/api/employee/:employeeId`
- GET `/api/employee/:employeeId/companions`
- POST `/api/validate-companions`

### Pricing (4 endpoints)
- POST `/api/calculate-room-price`
- GET `/api/extra-bed-price/:hotelId`
- POST `/api/calculate-trip-total`
- POST `/api/calculate-prices-for-month`

### Transport (2 endpoints)
- GET `/api/transport-options`
- GET `/api/transport-allowance/:city`

### Room Types (2 endpoints)
- GET `/api/room-types`
- GET `/api/room-type/:key`

## Function Naming Convention

All functions follow camelCase with first letter lowercase:
- `getAllCities`
- `getHotelsByCity`
- `getEmployeeById`
- `calculateRoomPrice`
- `getTransportAllowanceForCity`

## Key Features

1. **Modular Architecture**: Clear separation of concerns (data, services, routes)
2. **Static Data**: All functions return test data (no database required yet)
3. **Database Ready**: Configuration prepared for future database integration
4. **CORS Enabled**: Ready for frontend integration
5. **Error Handling**: Consistent error responses across all endpoints
6. **Pricing Algorithm**: Complex calculations for room prices with date/hotel/type factors

## Running the Application

### Start Server
```bash
npm start
# or
node server/app.js
```

### Test API
```bash
node test-api.js
```

### Build (No-op for Node.js)
```bash
npm run build
```

## Future Database Integration

The `server/config/database.js` file is prepared for database connection.
To integrate with Supabase or another database:

1. Update environment variables in `.env`
2. Install database client (e.g., `@supabase/supabase-js`)
3. Replace static data imports in services with database queries
4. Maintain same API interface (no changes to routes needed)

## Dependencies

- **express**: Web framework (v5.1.0)
- **cors**: CORS middleware (v2.8.5)

## Notes

- No behavioral changes were made to existing functionality
- All functions use camelCase naming convention
- Static data structured to match original application requirements
- Ready for database integration without API changes
