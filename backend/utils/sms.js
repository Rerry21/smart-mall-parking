const axios = require('axios');

const SMS_CONFIG = {
  apiKey: process.env.AFRICAS_TALKING_API_KEY,
  username: process.env.AFRICAS_TALKING_USERNAME || 'sandbox',
  apiUrl: 'https://api.sandbox.africastalking.com/version1'
};

async function sendSMS(phoneNumber, message) {
  try {
    await axios.post(`${SMS_CONFIG.apiUrl}/messaging`, 
      `username=${SMS_CONFIG.username}&to=${phoneNumber}&message=${encodeURIComponent(message)}`, 
      {
        headers: {
          'apiKey': SMS_CONFIG.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return { success: true };
  } catch (error) {
    console.error("SMS Error:", error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { sendSMS };