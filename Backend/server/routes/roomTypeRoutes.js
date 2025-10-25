const express = require('express');
const router = express.Router();
const { ROOM_TYPES } = require('../data/roomTypes');
const { getAllRoomTypes } = require('../services/roomTypeService');

router.get('/room-types', (req, res) => {
  getAllRoomTypes();
  res.json({ success: true, data: ROOM_TYPES });
});


module.exports = router;
