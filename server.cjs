const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Proxy to get updates from Telegram
app.post('/api/telegram/getUpdates', async (req, res) => {
  const { botToken, offset } = req.body;
  try {
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates`, {
      params: { offset, allowed_updates: ['message', 'edited_message'] }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy to delete message
app.post('/api/telegram/deleteMessage', async (req, res) => {
  const { botToken, chatId, messageId } = req.body;
  try {
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      chat_id: chatId,
      message_id: messageId
    });
    res.json(response.data);
  } catch (error) {
    // Telegram returns 400 if message not found or already deleted
    res.status(200).json({ error: error.message, note: "Ignored error" });
  }
});

// Proxy to edit message
app.post('/api/telegram/editMessage', async (req, res) => {
  const { botToken, chatId, messageId, text } = req.body;
  try {
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: text
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy to send message (optional, for restoring or debugging)
app.post('/api/telegram/sendMessage', async (req, res) => {
    const { botToken, chatId, text } = req.body;
    try {
      const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: text
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

app.listen(port, () => {
  console.log(`Telegram Proxy Server running on port ${port}`);
});
