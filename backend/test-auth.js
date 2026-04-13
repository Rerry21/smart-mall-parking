require('dotenv').config();
const axios = require('axios');

async function testMpesaAuth() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  try {
    const response = await axios.get(
      `${process.env.MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    console.log("✅ SUCCESS! Access Token received");
    console.log("Token:", response.data.access_token);
  } catch (error) {
    console.error("❌ AUTH FAILED");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Message:", error.message);
    }
  }
}

testMpesaAuth();