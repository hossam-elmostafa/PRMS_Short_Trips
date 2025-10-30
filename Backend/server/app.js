const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const hotelRoutes = require('./routes/hotelRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const transportRoutes = require('./routes/transportRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const companionRoutes = require('./routes/companionRoutes');
const adminRoutes = require('./routes/adminRoutes');


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
// Allow serving a runtime config.json from an external file outside the packaged app.
// Set environment variable RUNTIME_CONFIG_PATH to the absolute path of the config.json
// you want to serve (this file can live outside the EXE). If not provided or the
// file is missing, we fall back to the embedded Client/build/config.json.
const RUNTIME_CONFIG_PATH = process.env.RUNTIME_CONFIG_PATH || process.env.RUNTIME_CONFIG_FILE || process.env.BASE_API_CONFIG_PATH;

app.get('/config.json', (req, res) => {
  // Try external path first
  if (RUNTIME_CONFIG_PATH) {
    try {
      if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
        const stats = fs.statSync(RUNTIME_CONFIG_PATH);
        if (stats.isFile()) {
          const data = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8');
          res.set('Content-Type', 'application/json');
          res.set('Cache-Control', 'no-cache');
          return res.send(data);
        } else {
          console.warn('[config] runtime config path exists but is not a file:', RUNTIME_CONFIG_PATH);
        }
      } else {
        console.info('[config] runtime config not found at', RUNTIME_CONFIG_PATH);
      }
    } catch (err) {
      console.error('[config] error reading runtime config:', err && err.message ? err.message : err);
    }
  }

  // Fallback to embedded config.json inside the build folder
  const embeddedConfig = path.join(__dirname, 'Client/build', 'config.json');
  if (fs.existsSync(embeddedConfig)) {
    try {
      const data = fs.readFileSync(embeddedConfig, 'utf8');
      res.set('Content-Type', 'application/json');
      res.set('Cache-Control', 'no-cache');
      return res.send(data);
    } catch (err) {
      console.error('[config] error reading embedded config:', err);
    }
  }

  // Nothing available — return empty object so client has a valid JSON response
  res.set('Content-Type', 'application/json');
  res.set('Cache-Control', 'no-cache');
  return res.send('{}');
});

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
      roomTypes: '/api/room-types',
      lastCompanions: '/api/last-companions'

    }
  });
});

app.use('/api', hotelRoutes);
app.use('/api', companionRoutes);
app.use('/api', pricingRoutes);
app.use('/api', transportRoutes);
app.use('/api', roomTypeRoutes);
app.use('/api/admin', adminRoutes); // Admin endpoints

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
