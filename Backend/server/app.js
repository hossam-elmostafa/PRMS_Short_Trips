require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const hotelRoutes = require('./routes/hotelRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const transportRoutes = require('./routes/transportRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const companionRoutes = require('./routes/companionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const imageRoutes = require('./routes/imageRoutes');

// Check database connection on startup
const prisma = require('./lib/prisma');
(async () => {
    try {
        await prisma.$connect();
        console.log('[Short Trips] ✅ Database connection successful');
        if (!process.env.DATABASE_URL) {
            console.warn('[Short Trips] ⚠️ DATABASE_URL not set. Using default Prisma connection.');
        }
    } catch (error) {
        console.error('[Short Trips] ❌ Database connection failed:', error.message);
        console.error('[Short Trips] Please ensure DATABASE_URL is set correctly.');
    }
})();

// Initialize image service early to load configuration and log status
const imageService = require('./services/imageService');
console.log('[Server] Image service initialized with base path:', imageService.basePath);

const debug=true;

const app = express();
const PORT = process.env.PORT || 909;
const certPath = path.join(process.cwd(), 'certs');
// ✅ SSL certificate paths - only load if not in gateway mode
let sslOptions = null;
if (!process.env.GATEWAY_MODE && fs.existsSync(path.join(certPath, 'localhost.key'))) {
  try {
    sslOptions = {
      key: fs.readFileSync(path.join(certPath, 'localhost.key')),
      cert: fs.readFileSync(path.join(certPath, 'localhost.crt')),
    };
  } catch (err) {
    console.warn('[Short Trips] Failed to load SSL certificates:', err);
  }
}

// 2. Define your CORS options
const allowedDomains = ['www.first-systems.com','localhost','Phpco.local', '127.0.0.1', '0.0.0.0'];

const corsOptions = {
  origin: function (origin, callback) {
    //console.log('CORS Origin:', origin);
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);
    
    // When running in gateway mode, allow all origins (gateway handles CORS)
    if (process.env.GATEWAY_MODE === 'true') {
      return callback(null, true);
    }

    // Check if the incoming origin is the one we want to allow
    try {
      const url = new URL(origin);
      //console.log('CORS Hostname:', url.hostname);
      const hostname = url.hostname;
      //console.log('CORS Hostname:', hostname);

      if (allowedDomains.includes(hostname)) {
        callback(null, true); // Allow any port on the allowed domain
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } catch (err) {
      callback(new Error('Invalid origin'));
    }


    // if (allowedOrigins.includes(origin) || !origin) {
    //   callback(null, true); // Allow the request
    // } else {
    //   callback(new Error('Not allowed by CORS')); // Block the request
    // }
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// IMPORTANT: Serve static files BEFORE other routes
// This ensures assets are served before any route handlers interfere
const staticPath = path.join(__dirname, 'Client/build');
console.log('[Short Trips] Serving static files from:', staticPath);
console.log('[Short Trips] Static path exists:', fs.existsSync(staticPath));

// Debug middleware to see all /shorttrips requests
app.use('/shorttrips', (req, res, next) => {
  console.log('[Short Trips] Incoming request:', req.method, req.path, req.originalUrl);
  next();
});

// Serve static files under /shorttrips path for gateway mode
// This MUST be before route handlers to catch asset requests
app.use('/shorttrips', express.static(staticPath, {
  index: false, // Prevent express.static from serving index.html
  dotfiles: 'ignore',
}));

// Also serve static files at root for direct asset access (standalone mode)
app.use(express.static(staticPath, {
  index: false, // Prevent express.static from serving index.html
  dotfiles: 'ignore',
}));

// Log all API requests for debugging
app.use('/shorttrips/api', (req, res, next) => {
  if (req.path.includes('hotel-image')) {
    console.log('[API] Request to:', req.method, req.path, 'Query:', req.query);
  }
  next();
});

////////////////////////////////////////////////
// Serve config.json from the React app's build directory
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

// Custom handling for all routes, serving index.html
// Handle /shorttrips/employee without userID - serve index.html directly
app.get('/shorttrips/employee', (req, res) => {
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

// Handle /shorttrips/employee/:userID
app.get('/shorttrips/employee/:userID', (req, res) => {
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
      hotels: '/shorttrips/api/hotels',
      employees: '/shorttrips/api/employees',
      pricing: '/shorttrips/api/pricing',
      transport: '/shorttrips/api/transport',
      roomTypes: '/shorttrips/api/room-types',
      lastCompanions: '/shorttrips/api/last-companions',
      hotelImage: '/shorttrips/api/hotel-image?path=IMAGE_PATH'
    }
  });
});


app.use('/shorttrips/api', hotelRoutes);
app.use('/shorttrips/api', companionRoutes);
app.use('/shorttrips/api', pricingRoutes);
app.use('/shorttrips/api', transportRoutes);
app.use('/shorttrips/api', roomTypeRoutes);
app.use('/shorttrips/api/admin', adminRoutes); // Admin endpoints
app.use('/shorttrips/api/images', imageRoutes);


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Only start the server if not running in gateway mode
if (!process.env.GATEWAY_MODE) {
  if(debug==false){
    // Create HTTPS server  
    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`✅ HTTPS Server running at https://localhost:${PORT}`);
      console.log(`📘 API Documentation: https://localhost:${PORT}/`);
    });
  }
  else{
    app.listen(PORT, () => {
      console.log(`✅ HTTP Server running at http://localhost:${PORT}`);
      console.log(`📘 API Documentation: http://localhost:${PORT}/`);
    });
  }
} else {
  console.log('[Short Trips] Running in gateway mode - server will not start here');
}

module.exports = app;
