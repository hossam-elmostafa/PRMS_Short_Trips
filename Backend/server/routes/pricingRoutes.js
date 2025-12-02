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
        try {
            const result = await submitTripApplication(employeeId, familyIds, hotels);
            
            console.log("[submit] Result:", { success: result.success });
            
            // Always return 200 to prevent network errors in frontend
            return res.status(200).json(result);
        } catch (error) {
            console.error('[submit] Error:', error);
            // Return 200 with error details to prevent network error
            return res.status(200).json({
                success: false,
                message: error.message || 'Failed to submit trip application',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
});

// RQ-AZ-PR-31-10-2024.1: Review Trip and Calculate Cost
router.post('/review-trip', async (req, res) => {
    try {
        console.log("[review-trip] Request received:", { employeeId: req.body.employeeId, hotelsCount: req.body.hotels?.length });
        const { employeeId, familyIds, hotels, lang } = req.body;
        
        if (!employeeId) {
            return res.status(200).json({
                success: false,
                message: 'Employee ID is required'
            });
        }
        
        if (!hotels || !Array.isArray(hotels)) {
            return res.status(200).json({
                success: false,
                message: 'Hotels must be an array'
            });
        }
        
        const result = await reviewTripAndCalculateCost(lang || 'ar', employeeId, familyIds || '', hotels);
        
        console.log("[review-trip] Result:", { success: result.success, hasData: !!result.data });
        
        // Always return 200 to prevent network errors in frontend
        return res.status(200).json(result);
    } catch (error) {
        console.error('[review-trip] Error:', error);
        // Return 200 with error details to prevent network error
        return res.status(200).json({
            success: false,
            message: error.message || 'Failed to review trip and calculate cost',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// RQ-AZ-PR-31-10-2024.1: Check Trip Submission
router.post('/check-submission', async (req, res) => {
    try {
        const { employeeId, lang } = req.body;
        
        console.log('[check-submission] Request received:', { employeeId, lang });
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }
        
        const result = await checkTripSubmission(lang || 'ar', employeeId);
        
        console.log('[check-submission] Result:', result);
        
        // Always return 200, but include success flag in response
        // This prevents network errors in frontend
        return res.status(200).json({
            success: result.success || false,
            readonlyMode: result.success || false, // If submission exists, readonlyMode is true
            message: result.message || ''
        });
    } catch (error) {
        console.error('[check-submission] Error:', error);
        // Return 200 with success: false to prevent network error
        return res.status(200).json({
            success: false,
            readonlyMode: false,
            message: error.message || 'Failed to check trip submission',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
