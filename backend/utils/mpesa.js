const axios = require('axios');

const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  shortCode: process.env.MPESA_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  apiUrl: process.env.MPESA_API_URL || 'https://sandbox.safaricom.co.ke'
};

async function getAccessToken() {
  const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
  const response = await axios.get(`${MPESA_CONFIG.apiUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return response.data.access_token;
}

async function initiateStkPush(phoneNumber, amount, accountReference) {
  const accessToken = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64');

  const response = await axios.post(`${MPESA_CONFIG.apiUrl}/mpesa/stkpush/v1/processrequest`, {
    BusinessShortCode: MPESA_CONFIG.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: MPESA_CONFIG.shortCode,
    PhoneNumber: phoneNumber,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: 'Parking Payment'
  }, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data;
}

module.exports = { initiateStkPush };