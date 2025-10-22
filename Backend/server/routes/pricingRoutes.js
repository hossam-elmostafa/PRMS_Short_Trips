const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricingService');
const e = require('cors');
submitTripApplication = require('../controllers/dbController').submitTripApplication;

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
router.get('/submitt', async (req, res) => {
    // try {
    //     const { employeeId, familyIds, hotels } = req.body;

    //     // Validate required fields
    //     if (!employeeId) {
    //         return res.status(400).json({
    //             success: false,
    //             message: 'Employee ID is required'
    //         });
    //     }

    //     // Validate hotels array if provided
    //     if (hotels && !Array.isArray(hotels)) {
    //         return res.status(400).json({
    //             success: false,
    //             message: 'Hotels must be an array'
    //         });
    //     }

    //     // Validate each hotel object
    //     if (hotels && hotels.length > 0) {
    //         for (const hotel of hotels) {
    //             if (!hotel.hotelCode || !hotel.date) {
    //                 return res.status(400).json({
    //                     success: false,
    //                     message: 'Each hotel must have hotelCode and date'
    //                 });
    //             }
    //         }
    //     }

        // Call the submit function
        // const result = await submitTripApplication(
        //     employeeId,
        //     familyIds,
        //     hotels || []
        // );

        const result = await submitTripApplication();

        // Return appropriate status code based on result
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    // } catch (error) {
    //     console.error('Error in trip submission route:', error);
    //     return res.status(500).json({
    //         success: false,
    //         message: 'Internal server error',
    //         error: error.message
    //     });
    // }
});

router.post('/submit', async(req, res) => {
      
  // const employeeId = '100005';
  //       const familyIds = '100005-210|100005-209|100005-208';
  //       const hotels = [
  //           { hotelCode: 'EG-ALX-001', date: '15 NOV 2025', roomsData: 'D,2,0|S,1,0|J,1,0' },
  //           { hotelCode: 'EG-HUR-002', date: '16 NOV 2025', roomsData: 'S,2,2' },
  //           { hotelCode: 'EG-ALX-003', date: '17 NOV 2025', roomsData: 'S,3,1' }
  //       ];
  const { employeeId, familyIds, hotels } = req.body;
  console.log('Received submission data:', { employeeId, familyIds, hotels });

        // Validate required fields
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        // Validate hotels array if provided
        if (hotels && !Array.isArray(hotels)) {
            return res.status(400).json({
                success: false,
                message: 'Hotels must be an array'
            });
        }

        // Validate each hotel object
        if (hotels && hotels.length > 0) {
            for (const hotel of hotels) {
                if (!hotel.hotelCode || !hotel.date) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each hotel must have hotelCode and date'
                    });
                }
            }
        }


////////////////////////////////////////////////////////////////////////////////////        
  const result =  await submitTripApplication(employeeId, familyIds, hotels);

        // Return appropriate status code based on result
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }
});

module.exports = router;
