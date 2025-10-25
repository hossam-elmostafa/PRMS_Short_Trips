const { getHotelsFromDB,getHotelsByCityFromDB, getCitiesFromDB, getPolicyDataFromDB, getHotelRoomsPricingFromDB } = require('../controllers/dbController');



async function getAllHotels() {
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

module.exports = {
  getAllCities,
  getAllHotels,
  getHotelsByCity,
  getPolicyData,
  getHotelRoomPrices,
  submitTrip
};