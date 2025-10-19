const express = require('express');
const cors = require('cors');

const hotelRoutes = require('./routes/hotelRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const transportRoutes = require('./routes/transportRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const companionRoutes = require('./routes/companionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Travel Management API',
    version: '1.0.0',
    endpoints: {
      hotels: '/api/hotels',
      employees: '/api/employees',
      pricing: '/api/pricing',
      transport: '/api/transport',
      roomTypes: '/api/room-types'
    }
  });
});

app.use('/api', hotelRoutes);
app.use('/api', companionRoutes);
app.use('/api', pricingRoutes);
app.use('/api', transportRoutes);
app.use('/api', roomTypeRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/`);
});

module.exports = app;
