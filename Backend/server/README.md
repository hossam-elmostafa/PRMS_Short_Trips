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

## Runtime client configuration (external config.json)

You can provide a runtime `config.json` for the frontend that is read at app startup. This is useful when the frontend is packaged into an EXE (or otherwise embedded) and you want to change the API host/port without rebuilding.

How it works:
- The server exposes `GET /config.json`. On startup the frontend fetches this endpoint to read runtime values such as `BASE_URL` and `PORT`.
- `app.js` tries to read an external file pointed to by the environment variable `RUNTIME_CONFIG_PATH` (or `RUNTIME_CONFIG_FILE` / `BASE_API_CONFIG_PATH`). If that file exists it will be returned. Otherwise the server falls back to the embedded `Client/build/config.json`.

Usage:
- Create a JSON file outside the EXE, for example `C:\my-config\config.json` with contents:

```json
{
	"BASE_URL": "localhost",
	"BASE_API_PORT": 9091
}
```

- Start the server (or EXE) with the environment variable pointing to that file:

Windows PowerShell:

```powershell
$env:RUNTIME_CONFIG_PATH = 'C:\my-config\config.json';
node server/app.js
```

Or set the environment variable permanently or via your service manager.

If the external file is not present the server will use the embedded `public/config.json` from the build, so the client is still functional.

## Test Data

All functions return static test data from the following files:
- `server/data/hotels.js` - Hotel and city data
- `server/data/employees.js` - Employee and companion data
- `server/data/roomTypes.js` - Room type configurations
- `server/data/transportAllowances.js` - Transport allowance options

## Database Configuration

Database configuration is prepared in `server/config/database.js` but not yet connected.
