# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### 1. Hotel Management

#### getAllCities
Get list of all available cities.

**Endpoint:** `GET /cities`

**Response:**
```json
{
  "success": true,
  "data": ["القاهرة", "الإسكندرية", "شرم الشيخ", ...]
}
```

---

#### getHotelsByCity
Get all hotels in a specific city.

**Endpoint:** `GET /hotels/:city`

**Parameters:**
- `city` (path) - City name in Arabic

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "c_fs_nile",
      "en": "Four Seasons Hotel Cairo at Nile Plaza",
      "ar": "فندق فورسيزونز نايل بلازا"
    }
  ]
}
```

---

#### getHotelById
Get hotel details by ID.

**Endpoint:** `GET /hotel/:hotelId`

**Parameters:**
- `hotelId` (path) - Hotel ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "c_fs_nile",
    "en": "Four Seasons Hotel Cairo at Nile Plaza",
    "ar": "فندق فورسيزونز نايل بلازا",
    "city": "القاهرة"
  }
}
```

---

#### getMaxExtraBedsForHotel
Get maximum extra beds allowed per room type for a hotel.

**Endpoint:** `GET /hotel/:hotelId/extra-beds`

**Parameters:**
- `hotelId` (path) - Hotel ID

**Response:**
```json
{
  "success": true,
  "data": {
    "single": 2,
    "double": 1,
    "trible": 0,
    "family_room": 2,
    "family_suite": 1,
    "joiner_suite": 2
  }
}
```

---

### 2. Employee Management

#### getEmployeeById
Get employee details.

**Endpoint:** `GET /employee/:employeeId`

**Parameters:**
- `employeeId` (path) - Employee ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 100325,
    "name": "جمال الدين محمود أحمد السيد",
    "department": "إدارة العلاقات العامة",
    "companions": [...]
  }
}
```

---

#### getEmployeeCompanions
Get list of employee's companions.

**Endpoint:** `GET /employee/:employeeId/companions`

**Parameters:**
- `employeeId` (path) - Employee ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rel": "زوجة",
      "name": "رانا على مسعد إبراهيم"
    }
  ]
}
```

---

#### validateCompanionCount
Validate if companion count is within limits.

**Endpoint:** `POST /validate-companions`

**Body:**
```json
{
  "companionCount": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "message": "Valid companion count"
  }
}
```

---

### 3. Pricing Management

#### calculateRoomPrice
Calculate price for a specific room type on a date.

**Endpoint:** `POST /calculate-room-price`

**Body:**
```json
{
  "hotelId": "c_fs_nile",
  "date": "2025-10-25",
  "roomTypeKey": "double"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "price": 2320
  }
}
```

---

#### getExtraBedPrice
Get extra bed price for a hotel.

**Endpoint:** `GET /extra-bed-price/:hotelId`

**Parameters:**
- `hotelId` (path) - Hotel ID

**Response:**
```json
{
  "success": true,
  "data": {
    "price": 500
  }
}
```

---

#### calculateTripTotal
Calculate total cost for a trip including employee share.

**Endpoint:** `POST /calculate-trip-total`

**Body:**
```json
{
  "hotelId": "c_fs_nile",
  "date": "2025-10-25",
  "roomCounts": {
    "double": 2,
    "single": 1
  },
  "extraBedCounts": {
    "double": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 6360,
    "employeeShare": 3816,
    "employeePercentage": 60
  }
}
```

---

#### calculatePricesForMonth
Get prices for all days in a month.

**Endpoint:** `POST /calculate-prices-for-month`

**Body:**
```json
{
  "hotelId": "c_fs_nile",
  "year": 2025,
  "month": 9,
  "roomTypeKey": "double"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-10-01",
      "day": 1,
      "price": 2280
    }
  ]
}
```

---

### 4. Transport Management

#### getAllTransportOptions
Get all transport allowance options.

**Endpoint:** `GET /transport-options`

**Response:**
```json
{
  "success": true,
  "data": ["لايوجد", "300", "400", "500", "600", "700"]
}
```

---

#### getTransportAllowanceForCity
Get transport allowance for a specific city.

**Endpoint:** `GET /transport-allowance/:city`

**Parameters:**
- `city` (path) - City name in Arabic

**Response:**
```json
{
  "success": true,
  "data": {
    "allowance": "500"
  }
}
```

---

### 5. Room Type Management

#### getRoomTypes
Get all room types with their factors.

**Endpoint:** `GET /room-types`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "single",
      "ar": "فردي",
      "factor": 1.0
    }
  ]
}
```

---

#### getRoomTypeByKey
Get specific room type details.

**Endpoint:** `GET /room-type/:key`

**Parameters:**
- `key` (path) - Room type key (e.g., "single", "double")

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "double",
    "ar": "مزدوج",
    "factor": 1.4
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing parameters)
- `404` - Not Found
- `500` - Internal Server Error

---

## Function Naming Convention

All functions use camelCase with first letter lowercase:
- `getAllCities()`
- `getHotelsByCity()`
- `getEmployeeById()`
- `calculateRoomPrice()`
- `getTransportAllowanceForCity()`

---

## Testing

Run the test script:
```bash
node test-api.js
```

Start the server:
```bash
npm start
```

or

```bash
node server/app.js
```
