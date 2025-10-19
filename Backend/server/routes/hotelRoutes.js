const express = require('express');
const router = express.Router();
const hotelService = require('../services/hotelService');

// router.get('/cities', (req, res) => {
//   const cities = hotelService.getAllCities();
//   res.json({ success: true, data: cities });
// });

// router.get('/hotels/:city', (req, res) => {
//   const { city } = req.params;
//   const hotels = hotelService.getHotelsByCity(city);

//   if (hotels.length === 0) {
//     return res.status(404).json({ success: false, message: 'City not found' });
//   }

//   res.json({ success: true, data: hotels });
// });

router.get('/hotels', (req, res) => {
  const hotels = hotelService.getAllHotels();

  if (hotels.length === 0) {
    return res.status(404).json({ success: false, message: 'Hotel not found' });
  }

  res.json({ success: true, data: hotels });
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
