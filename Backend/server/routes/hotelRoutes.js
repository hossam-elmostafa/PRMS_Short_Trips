const express = require('express');
const router = express.Router();
const hotelService = require('../services/hotelService');

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

module.exports = router;
