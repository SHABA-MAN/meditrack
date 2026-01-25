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

// Proxy to get YouTube playlist info
app.post('/api/youtube/playlistInfo', async (req, res) => {
  const { playlistId, apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'YouTube API Key is required' });
  }
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
      params: {
        part: 'snippet,contentDetails',
        id: playlistId,
        key: apiKey
      }
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const playlist = response.data.items[0];
      const thumbnails = playlist.snippet.thumbnails;
      const thumbnail = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url;
      
      res.json({
        title: playlist.snippet.title,
        description: playlist.snippet.description,
        itemCount: playlist.contentDetails.itemCount,
        thumbnail: thumbnail
      });
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy to get YouTube video info
app.post('/api/youtube/videoInfo', async (req, res) => {
  const { videoId, apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'YouTube API Key is required' });
  }
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet',
        id: videoId,
        key: apiKey
      }
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      const thumbnails = video.snippet.thumbnails;
      const thumbnail = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url;
      
      res.json({
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: thumbnail
      });
    } else {
      res.status(404).json({ error: 'Video not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Telegram Proxy Server running on port ${port}`);
});
