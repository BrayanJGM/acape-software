const axios = require('axios');
const configs = require('./../configs.json');

async function sendMessage(message){
  let finalMessage = encodeURIComponent(message);

  // return finalMessage;

  let finalDataMessage = await axios.get(`https://api.callmebot.com/whatsapp.php?phone=${configs.whatsapp.number}&text=${finalMessage}&apikey=${configs.whatsapp.apikey}`);

  return finalDataMessage;
}

module.exports = sendMessage;
