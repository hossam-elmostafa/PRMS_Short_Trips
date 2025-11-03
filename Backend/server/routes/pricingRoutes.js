const express = require('express');
const router = express.Router();
const e = require('cors');
const submitTripApplication = require('../controllers/dbController').submitTripApplication;
const { reviewTripAndCalculateCost, checkTripSubmission } = require('../controllers/dbController');

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

// RQ-AZ-PR-31-10-2024.1: Review Trip and Calculate Cost
router.post('/review-trip', async (req, res) => {
    console.log("review-trip: "+ req.body);
    const { employeeId, familyIds, hotels, lang } = req.body;
    
    if (!employeeId) {
        return res.status(400).json({
            success: false,
            message: 'Employee ID is required'
        });
    }
    
    if (!hotels || !Array.isArray(hotels)) {
        return res.status(400).json({
            success: false,
            message: 'Hotels must be an array'
        });
    }
    
    const result = await reviewTripAndCalculateCost(lang || 'ar', employeeId, familyIds || '', hotels);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
});

// RQ-AZ-PR-31-10-2024.1: Check Trip Submission
router.post('/check-submission', async (req, res) => {
    const { employeeId, lang } = req.body;
    
    if (!employeeId) {
        return res.status(400).json({
            success: false,
            message: 'Employee ID is required'
        });
    }
    
    const result = await checkTripSubmission(lang || 'ar', employeeId);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
});

module.exports = router;
