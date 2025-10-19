const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricingService');

// router.post('/calculate-room-price', (req, res) => {
//   const { hotelId, date, roomTypeKey } = req.body;

//   if (!hotelId || !date || !roomTypeKey) {
//     return res.status(400).json({
//       success: false,
//       message: 'Missing required parameters: hotelId, date, roomTypeKey'
//     });
//   }

//   const price = pricingService.calculateRoomPrice(hotelId, date, roomTypeKey);

//   res.json({ success: true, data: { price } });
// });

// router.get('/extra-bed-price/:hotelId', (req, res) => {
//   const { hotelId } = req.params;
//   const price = pricingService.getExtraBedPrice(hotelId);

//   res.json({ success: true, data: { price } });
// });

// router.post('/calculate-trip-total', (req, res) => {
//   const { hotelId, date, roomCounts, extraBedCounts } = req.body;

//   if (!hotelId || !date || !roomCounts) {
//     return res.status(400).json({
//       success: false,
//       message: 'Missing required parameters: hotelId, date, roomCounts'
//     });
//   }

//   const total = pricingService.calculateTripTotal(
//     hotelId,
//     date,
//     roomCounts,
//     extraBedCounts || {}
//   );

//   const employeeShare = pricingService.calculateEmployeeShare(total);

//   res.json({
//     success: true,
//     data: {
//       total,
//       employeeShare,
//       employeePercentage: 60
//     }
//   });
// });

// router.post('/calculate-prices-for-month', (req, res) => {
//   const { hotelId, year, month, roomTypeKey } = req.body;

//   if (!hotelId || !year || month === undefined || !roomTypeKey) {
//     return res.status(400).json({
//       success: false,
//       message: 'Missing required parameters: hotelId, year, month, roomTypeKey'
//     });
//   }

//   const daysInMonth = new Date(year, month + 1, 0).getDate();
//   const prices = [];

//   for (let day = 1; day <= daysInMonth; day++) {
//     const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
//     const price = pricingService.calculateRoomPrice(hotelId, date, roomTypeKey);
//     prices.push({ date, day, price });
//   }

//   res.json({ success: true, data: prices });
// });

module.exports = router;
