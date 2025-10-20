const express = require('express');
const router = express.Router();
const hotelService = require('../services/hotelService');

// router.get('/cities', (req, res) => {
//   const cities = hotelService.getAllCities();
//   res.json({ success: true, data: cities });
// });

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

router.get('/hotels', (req, res) => {
  const hotels = hotelService.getAllHotels();

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




// router.get('/hotel/:hotelId', (req, res) => {
//   const { hotelId } = req.params;
//   const hotel = hotelService.getHotelById(hotelId);

//   if (!hotel) {
//     return res.status(404).json({ success: false, message: 'Hotel not found' });
//   }

//   res.json({ success: true, data: hotel });
// });

// router.get('/hotel/:hotelId/extra-beds', (req, res) => {
//   const { hotelId } = req.params;
//   const maxExtraBeds = hotelService.getMaxExtraBedsForHotel(hotelId);

//   res.json({ success: true, data: maxExtraBeds });
// });

module.exports = router;
