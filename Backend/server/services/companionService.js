const { COMPANIONS } = require('../data/companions');

function getCompanions(){
  return COMPANIONS;
}

function getMaximumNoOfCompanions(){
  return 6;
}

module.exports = {
  getCompanions,
  getMaximumNoOfCompanions
};
