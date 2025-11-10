const express = require('express');
const router = express.Router();
const hotelService = require('../services/hotelService');
const fs = require('fs');
const path = require('path');

router.get('/hotels/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { lang } = req.query; // optional: might be 'en', 'en-US', etc.
    // BUG-AZ-PR-29-10-2025.1: Normalize language to 'ar'|'en' to avoid Arabic cities in EN mode
    const normLang = String(lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
    const hotels = await hotelService.getHotelsByCity(city, normLang);
    // Always return 200 for better UX; empty list if nothing found
    res.json({ success: true, data: hotels || [] });
  } catch (error) {
    console.error('Error in hotels by city route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// BUG-AZ-PR-29-10-2025.1: Fixed by AG - Added language parameter support for hotels endpoint
// Issue: In English mode, cities were showing in Arabic instead of English
// Solution: Extract lang from query params and pass to getAllHotels function
router.get('/hotels', async(req, res) => {
  try {
    const { lang } = req.query; // optional: might be 'en', 'en-US', etc.
    // BUG-AZ-PR-29-10-2025.1: Normalize language for hotels listing endpoint
    const normLang = String(lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
    const hotels = await hotelService.getAllHotels(normLang);

    if (!hotels || Object.keys(hotels).length === 0) {
      return res.status(404).json({ success: false, message: 'Hotel not found' });
    }

    res.json({ success: true, data: hotels });
  } catch (error) {
    console.error('Error in hotels route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/cities', async (req, res) => {
  try {
    const { lang } = req.query; // optional: might be 'en', 'en-US', etc.
    // BUG-AZ-PR-29-10-2025.1: Normalize language for cities endpoint
    const normLang = String(lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
    const cities = await hotelService.getAllCities(normLang);
    res.json({ success: true, data: cities });
  } catch (error) {
    console.error('Error in cities route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get actual room prices for a specific hotel and date
router.get('/hotel/:hotelCode/rooms', async (req, res) => {
  try {
    const { hotelCode } = req.params;
    const { date } = req.query; // Optional date parameter
    const pricing = await hotelService.getHotelRoomPrices(hotelCode, date);
    //console.log (pricing);
    res.json({ success: true, data: pricing });
  } catch (error) {
    console.error('Error in hotel rooms pricing route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }

});


router.get('/policy/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const policyData = await hotelService.getPolicyData(employeeId);
    res.json({ success: true, data: policyData });
  } catch (error) {
    console.error('Error in policy route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/form/submit/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const policyData = await hotelService.getPolicyData(employeeId);
    res.json({ success: true, data: policyData });
  } catch (error) {
    console.error('Error in policy route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/last-hotels/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    // BUG-AZ-PR-29-10-2025.1: Normalize language for last-hotels endpoint
    const normLang = String(req.query.lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
    const hotels = await hotelService.getLastHotels(employeeId, normLang);
    res.json({ success: true, data: hotels });
  } catch (error) {
    console.error('Error in last-hotels route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Debug endpoint to check image service configuration
router.get('/image-config', (req, res) => {
  try {
    const imageService = require('../services/imageService');
    const fs = require('fs');
    const path = require('path');
    
    const testPath = '143184823.jpg';
    let fullPath;
    let exists = false;
    let error = null;
    
    try {
      fullPath = imageService.getFullPath(testPath);
      exists = fs.existsSync(fullPath);
    } catch (e) {
      error = e.message;
    }
    
    res.json({
      basePath: imageService.basePath,
      basePathExists: fs.existsSync(imageService.basePath),
      testRelativePath: testPath,
      testFullPath: fullPath,
      testFileExists: exists,
      testError: error,
      processCwd: process.cwd(),
      envImagesBasePath: process.env.IMAGES_BASE_PATH,
      runtimeConfigPath: process.env.RUNTIME_CONFIG_PATH || process.env.RUNTIME_CONFIG_FILE || process.env.BASE_API_CONFIG_PATH
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/hotel-image', async (req, res) => {
  console.log('[hotel-image] Endpoint hit! Query:', req.query);
  try {
    const filepath = req.query.path;
    
    if (!filepath) {
      console.log('[hotel-image] Missing path parameter');
      return res.status(400).json({ error: 'Path parameter is required' });
    }
    
    const decodedPath = decodeURIComponent(filepath);
    console.log('[hotel-image] Requested image path from DB:', decodedPath);
    
    // Use imageService to handle path normalization and loading
    const imageService = require('../services/imageService');
    
    // Get the full path that will be used (for debugging)
    try {
      const fullPath = imageService.getFullPath(decodedPath);
      console.log('[hotel-image] Base path:', imageService.basePath);
      console.log('[hotel-image] Resolved full path:', fullPath);
    } catch (pathError) {
      console.error('[hotel-image] Error getting full path:', pathError.message);
    }
    
    // Check if image exists
    const exists = await imageService.imageExists(decodedPath);
    if (!exists) {
      const fullPath = imageService.getFullPath(decodedPath);
      console.log('[hotel-image] Image not found. Expected path:', fullPath);
      console.log('[hotel-image] Base path used:', imageService.basePath);
      console.log('[hotel-image] Relative path from DB:', decodedPath);
      
      // Try to return a default image if available
      const defaultImagePath = path.join(process.cwd(), 'public', 'default-hotel.jpg');
      if (fs.existsSync(defaultImagePath)) {
        console.log('[hotel-image] Serving default image');
        return res.sendFile(defaultImagePath);
      }
      
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS
      return res.status(404).json({ 
        error: 'Image not found', 
        message: `Image not found at expected path: ${fullPath}`,
        basePath: imageService.basePath,
        relativePath: decodedPath
      });
    }
    
    // Load and serve the image
    const imageBuffer = await imageService.loadImage(decodedPath);
    const mimeType = imageService.getMimeType(decodedPath);
    
    // Set headers for image response
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for images
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    console.log('[hotel-image] Successfully serving image:', decodedPath, 'Size:', imageBuffer.length, 'bytes');
    res.send(imageBuffer);
  } catch (error) {
    console.error('[hotel-image] Error serving hotel image:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});
module.exports = router;
