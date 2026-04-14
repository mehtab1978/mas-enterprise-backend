require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const WA_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const PORT = process.env.PORT || 3000;

const scheduledJobs = new Map();

// POST /api/callback - Receive form submission
app.post('/api/callback', async (req, res) => {
  try {
    const { phone, name, time, message } = req.body;

    if (!phone || !name || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const fullPhone = `91${cleanPhone}`;
    const jobId = scheduleCallback(fullPhone, name, time, message);

    res.json({
      success: true,
      message: `Callback scheduled for ${name}`,
      jobId
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function scheduleCallback(phone, name, time, message) {
  let cronExpression;

  switch (time) {
    case 'morning':
      cronExpression = '30 9 * * *'; // 9:30 AM
      break;
    case 'afternoon':
      cronExpression = '0 13 * * *'; // 1:00 PM
      break;
    case 'evening':
      cronExpression = '0 17 * * *'; // 5:00 PM
      break;
    case 'asap':
      const futureTime = new Date(Date.now() + 5 * 60 * 1000);
      const minutes = futureTime.getMinutes();
      const hours = futureTime.getHours();
      const date = futureTime.getDate();
      const month = futureTime.getMonth() + 1;
      cronExpression = `${minutes} ${hours} ${date} ${month} *`;
      break;
    default:
      cronExpression = '0 10 * * *';
  }

  const jobId = `${phone}-${Date.now()}`;

  const job = cron.schedule(cronExpression, async () => {
    console.log(`[${new Date().toISOString()}] Sending WhatsApp to ${phone}`);
    await sendWhatsAppMessage(phone, name, message);
  }, { timezone: 'Asia/Kolkata' });

  scheduledJobs.set(jobId, job);
  console.log(`✓ Callback scheduled for ${name} (${phone}) at ${time}`);
  return jobId;
}

async function sendWhatsAppMessage(phone, name, message) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: 'hello_world',
        language: {
          code: 'en_US'
        }
      }
    };

    const response = await axios.post(
      `https://graph.instagram.com/v18.0/${WA_PHONE_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✓ Message sent to ${phone}`);
    return response.data;

  } catch (error) {
    console.error(`✗ Failed to send to ${phone}:`, error.response?.data || error.message);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
