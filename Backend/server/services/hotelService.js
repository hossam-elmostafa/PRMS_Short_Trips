const { getHotelsFromDB,getHotelsByCityFromDB, getCitiesFromDB, getPolicyDataFromDB, getHotelRoomsPricingFromDB, getHotelPriceListFromDB, getLastHotelsFromDB } = require('../controllers/dbController');



// BUG-AZ-PR-29-10-2025.1: Fixed by AG - Added language parameter to getAllHotels
// Issue: Hotels were grouped by Arabic city names regardless of language
// Solution: Pass language parameter to database controller
async function getAllHotels(lang = 'ar') {
  return await getHotelsFromDB(lang);
}

async function getHotelsByCity(city, lang = 'ar', empCode = '') {
  return await getHotelsByCityFromDB(lang, city, empCode);
}

async function getAllCities(lang = 'ar', empCode = '') {
  return await getCitiesFromDB(lang, empCode);
}

async function getHotelRoomPrices(hotelCode, date = null, lang = 'en') {
  return await getHotelRoomsPricingFromDB(hotelCode, date, lang);
}

async function getHotelPriceList(hotelCode, lang = 'en') {
  return await getHotelPriceListFromDB(hotelCode, lang);
}

async function getPolicyData(employeeId) {
  return await getPolicyDataFromDB(employeeId);
}

async function submitTrip(employeeId, familyIds, hotels) {
 return await submitTripApplicationToDB(employeeId, familyIds, hotels);
}

async function getLastHotels(employeeId, lang = 'ar') {
  return await getLastHotelsFromDB(lang, employeeId);
}

module.exports = {
  getAllCities,
  getAllHotels,
  getHotelsByCity,
  getPolicyData,
  getHotelRoomPrices,
  getHotelPriceList,
  submitTrip,
  getLastHotels
};