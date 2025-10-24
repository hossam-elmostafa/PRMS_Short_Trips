const { HOTELS } = require('../data/hotels');
const { getHotelsFromDB,getHotelsByCityFromDB, getCitiesFromDB, getPolicyDataFromDB, getHotelRoomsPricingFromDB } = require('../controllers/dbController');

// function getAllCities() {
//   return Object.keys(HOTELS);
// }


async function getAllHotels() {
  //return HOTELS;
  return await getHotelsFromDB();
}

async function getHotelsByCity(city, lang = 'ar') {
  return await getHotelsByCityFromDB(lang, city);
}

async function getAllCities(lang = 'ar') {
  return await getCitiesFromDB(lang);
}

async function getHotelRoomPrices(hotelCode, date = null) {
  // return await get  return await getHotelRoomsPricingFromDB(hotelCode, date);
  return await getHotelRoomsPricingFromDB(hotelCode, date);
}

async function getPolicyData(employeeId) {
  return await getPolicyDataFromDB(employeeId);
}

async function submitTrip(employeeId, familyIds, hotels) {
 return await submitTripApplicationToDB(employeeId, familyIds, hotels);
}
// function getHotelsByCity(city) {
//   return HOTELS[city] || [];
// }

// function getHotelById(hotelId) {
//   for (const city in HOTELS) {
//     const hotel = HOTELS[city].find(h => h.id === hotelId);
//     if (hotel) {
//       return { ...hotel, city };
//     }
//   }
//   return null;
// }

// function getMaxExtraBedsForHotel(hotelId) {
//   const maxBeds = {};
//   const { ROOM_TYPES } = require('../data/roomTypes');

//   ROOM_TYPES.forEach(rt => {
//     maxBeds[rt.key] = Math.floor(Math.random() * 3);
//   });

//   return maxBeds;
// }

module.exports = {
  getAllCities,
  // getHotelsByCity,
  // getHotelById,
  // getMaxExtraBedsForHotel,
  getAllHotels,
  getHotelsByCity,
  getPolicyData,
  getHotelRoomPrices,
  submitTrip
};