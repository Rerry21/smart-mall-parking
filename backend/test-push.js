require('dotenv').config();
const axios = require('axios');

async function triggerStkPush() {
  const PHONE_NUMBER = "254794415433"; // <--- CHANGE THIS TO YOUR PHONE
  const AMOUNT = 1; // Test with 1 Shilling
  
  try {
    // 1. Get Access Token
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');
    
    const tokenRes = await axios.get(
      `${process.env.MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const token = tokenRes.data.access_token;

    // 2. Generate Timestamp & Password
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    // 3. Fire the Push
    console.log("🚀 Sending STK Push to:", PHONE_NUMBER);
    
    const response = await axios.post(
      `${process.env.MPESA_API_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: AMOUNT,
        PartyA: PHONE_NUMBER,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: PHONE_NUMBER,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "SmartParking",
        TransactionDesc: "Testing Payment"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("✅ REQUEST ACCEPTED:", response.data.CustomerMessage);
    console.log("📱 Check your phone now!");

  } catch (error) {
    console.error("❌ PUSH FAILED:", error.response ? error.response.data : error.message);
  }
}

triggerStkPush();