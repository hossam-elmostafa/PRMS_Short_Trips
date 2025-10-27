const express = require('express');
const router = express.Router();
const e = require('cors');
const submitTripApplication = require('../controllers/dbController').submitTripApplication;

// router.get('/submit', async (req, res) => {
//         const result = await submitTripApplication();

//         // Return appropriate status code based on result
//         if (result.success) {
//             return res.status(200).json(result);
//         } else {
//             return res.status(500).json(result);
//         }

// });

router.post('/submit', async(req, res) => {
      
  // const employeeId = '100005';
  //       const familyIds = '100005-210|100005-209|100005-208';
  //       const hotels = [
  //           { hotelCode: 'EG-ALX-001', date: '15 NOV 2025', roomsData: 'D,2,0|S,1,0|J,1,0' },
  //           { hotelCode: 'EG-HUR-002', date: '16 NOV 2025', roomsData: 'S,2,2' },
  //           { hotelCode: 'EG-ALX-003', date: '17 NOV 2025', roomsData: 'S,3,1' }
  //       ];
  const { employeeId, familyIds, hotels } = req.body;
  //console.log('Received trip submission:', { employeeId, familyIds, hotels });

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
