const roomTypes = require('../data/roomTypes');
const prisma = require('../lib/prisma');

function getAllRoomTypes() {
    return roomTypes;
}

async function getBedsCountByHotel(hotelCode) {
    try {
        // Query the database using Prisma's raw query functionality
        const results = await prisma.$queryRaw`
            SELECT HotelRoom_RoomType, HotelRoom_BedsCount 
            FROM PRMS_HotelRoom 
            WHERE HotelRoom_Hotel = ${hotelCode}
        `;

        // Convert the results into the required format { S: 1, D: 2, etc }
        const bedCounts = {};
        for (const row of results) {
            bedCounts[row.HotelRoom_RoomType] = row.HotelRoom_BedsCount;
        }

        return bedCounts;
    } catch (error) {
        console.error('Error fetching bed counts:', error);
        throw error;
    }
}

module.exports = {
    getAllRoomTypes,
    getBedsCountByHotel
};