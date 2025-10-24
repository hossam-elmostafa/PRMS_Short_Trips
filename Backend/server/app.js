const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const hotelRoutes = require('./routes/hotelRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const transportRoutes = require('./routes/transportRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const companionRoutes = require('./routes/companionRoutes');


const app = express();
const PORT = process.env.PORT || 909;

// 2. Define your CORS options
const allowedOrigins = ['http://www.first-systems.com:909','http://localhost:909','http://localhost:5005','http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    // Check if the incoming origin is the one we want to allow
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true); // Allow the request
    } else {
      callback(new Error('Not allowed by CORS')); // Block the request
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json());

////////////////////////////////////////////////
// Serve static files from the React app's build directory
app.use(express.static(path.join(__dirname, 'Client/build'), {
  index: false, // Prevent express.static from serving index.html
}));

// Custom handling for all routes, serving index.html with replaced API_URL
app.get('/employee/:userID', (req, res) => {
  // Read the index.html file
  const indexFilePath = path.resolve(__dirname, 'Client/build', 'index.html');
  fs.readFile(indexFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read index.html:', err);
      res.status(500).send('An error occurred');
      return;
    }
    res.send(data);
  });
});
////////////////////////////////////////////////




app.get('/inf', (req, res) => {
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
