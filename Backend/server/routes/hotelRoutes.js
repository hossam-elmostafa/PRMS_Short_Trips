const express = require('express');
const router = express.Router();
const hotelService = require('../services/hotelService');

router.get('/hotels/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { lang } = req.query; // optional: 'ar' | 'en'
    const hotels = await hotelService.getHotelsByCity(city, lang || 'ar');
    // Always return 200 for better UX; empty list if nothing found
    res.json({ success: true, data: hotels || [] });
  } catch (error) {
    console.error('Error in hotels by city route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/hotels', async(req, res) => {
  const hotels = await hotelService.getAllHotels();

  if (hotels.length === 0) {
    return res.status(404).json({ success: false, message: 'Hotel not found' });
  }

  res.json({ success: true, data: hotels });
});

router.get('/cities', async (req, res) => {
  try {
    const { lang } = req.query; // optional: 'ar' | 'en'
    const cities = await hotelService.getAllCities(lang || 'ar');
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

module.exports = router;
