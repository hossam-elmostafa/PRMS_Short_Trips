# Travel Management API

## Overview
Server-side API for managing employee travel requests with static test data.

## API Endpoints

### Hotels
- `GET /api/cities` - Get all available cities
- `GET /api/hotels/:city` - Get hotels by city
- `GET /api/hotel/:hotelId` - Get hotel details by ID
- `GET /api/hotel/:hotelId/extra-beds` - Get max extra beds configuration

### Employees
- `GET /api/employee/:employeeId` - Get employee details
- `GET /api/employee/:employeeId/companions` - Get employee companions
- `POST /api/validate-companions` - Validate companion count

### Pricing
- `POST /api/calculate-room-price` - Calculate price for a room type
- `GET /api/extra-bed-price/:hotelId` - Get extra bed price
- `POST /api/calculate-trip-total` - Calculate total trip cost
- `POST /api/calculate-prices-for-month` - Get prices for entire month

### Transport
- `GET /api/transport-options` - Get all transport allowance options
- `GET /api/transport-allowance/:city` - Get transport allowance for city

### Room Types
- `GET /api/room-types` - Get all room types
- `GET /api/room-type/:key` - Get specific room type

## Running the Server

```bash
node server/app.js
```

Server will start on port 3000 by default.

## Test Data

All functions return static test data from the following files:
- `server/data/hotels.js` - Hotel and city data
- `server/data/employees.js` - Employee and companion data
- `server/data/roomTypes.js` - Room type configurations
- `server/data/transportAllowances.js` - Transport allowance options

## Database Configuration

Database configuration is prepared in `server/config/database.js` but not yet connected.
