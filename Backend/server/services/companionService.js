const { COMPANIONS } = require('../data/companions');

function getCompanions(employeeId){
  return COMPANIONS[employeeId];
}

function getMaximumNoOfCompanions(){
  return 6;
}

module.exports = {
  getCompanions,
  getMaximumNoOfCompanions
};
