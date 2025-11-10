const express = require('express');
const imageService = require('../services/imageService');
// Fix the prisma import - adjust the path based on your project structure
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

/**
 * Load image by relative path
 * GET /api/images/load?path=Prms/Shorttrips/pic1.jpg
 */
router.get('/load', async (req, res) => {
    try {
        const { path: relativePath } = req.query;

        if (!relativePath) {
            return res.status(400).json({ error: 'Path parameter is required' });
        }

        // Check if image exists
        const exists = await imageService.imageExists(relativePath);
        if (!exists) {
            console.log(`Image not found: ${relativePath}`);
            return res.status(404).json({ error: 'Image not found' });
        }

        // Load image
        const imageBuffer = await imageService.loadImage(relativePath);
        const mimeType = imageService.getMimeType(relativePath);

        // Set appropriate headers
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        
        // Send image
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error loading image:', error);
        res.status(500).json({ error: 'Failed to load image', message: error.message });
    }
});

/**
 * LoadPicture function - Load image by hotel code
 * GET /api/images/hotel/:hotelCode
 * This function:
 * 1. Gets the relative path from the database for the given hotel code
 * 2. Combines it with the absolute base path from configuration
 * 3. Returns the image to the caller
 */
router.get('/hotel/:hotelCode', async (req, res) => {
    try {
        const { hotelCode } = req.params;

        if (!hotelCode) {
            return res.status(400).json({ error: 'Hotel code is required' });
        }

        // Get image path from database using the same query pattern as dbController
        // HOTEL_PIC is stored as VARCHAR(300) in the database
        const esc = (s) => String(s).replace(/'/g, "''");
        const hotelCodeEsc = esc(hotelCode.trim());
        
        const hotel = await prisma.$queryRawUnsafe(`
            SELECT LTRIM(RTRIM(HOTEL_CODE)) AS HOTEL_CODE, LTRIM(RTRIM(HOTEL_PIC)) AS HOTEL_PIC
            FROM PRMS_HOTEL
            WHERE LTRIM(RTRIM(HOTEL_CODE)) = '${hotelCodeEsc}'
        `);

        if (!hotel || hotel.length === 0 || !hotel[0].HOTEL_PIC) {
            console.log(`Image not found in database for hotel code: ${hotelCode}`);
            return res.status(404).json({ error: 'Image not found in database' });
        }

        // Get the relative path from database (may be absolute path for backward compatibility)
        const dbPath = String(hotel[0].HOTEL_PIC).trim();
        console.log(`Loading image for hotel ${hotelCode}, DB path: ${dbPath}`);

        // imageService will normalize the path (extract filename if absolute, use as-is if relative)
        // and combine it with the base path from configuration
        const exists = await imageService.imageExists(dbPath);
        if (!exists) {
            console.log(`Image file not found on disk for hotel ${hotelCode}, path: ${dbPath}`);
            return res.status(404).json({ error: 'Image file not found on disk' });
        }

        // Load and send image
        const imageBuffer = await imageService.loadImage(dbPath);
        const mimeType = imageService.getMimeType(dbPath);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error loading image by hotel code:', error);
        res.status(500).json({ error: 'Failed to load image', message: error.message });
    }
});

module.exports = router;