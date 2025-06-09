// api/index.js
"use strict";
const express = require("express");
const compression = require("compression");
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

let app = express();

// Apply middleware
app.use(compression());
app.use(bodyParser.json());
app.use(cors());

let apis = null;
const MAX_API_WAIT_TIME = 3000;
const MAX_TIME = 10000;

// Function to fetch APIs - made more robust for Vercel's stateless nature
async function getapis() {
    try {
        // You might want to cache this response more aggressively in a real app,
        // but for a simple demo, re-fetching is fine.
        const response = await axios.get('https://wtserver.glitch.me/apis');
        apis = response.data;
        console.log('データを取得しました:', apis);
    } catch (error) {
        console.error('データの取得に失敗しました:', error);
        apis = null; // Ensure apis is null on failure
    }
}

// Initial fetch when the function starts (can be infrequent on Vercel)
// In a serverless environment, this might run on each cold start.
// For better performance, consider a persistent caching mechanism if 'apis' changes infrequently.
getapis();

async function ggvideo(videoId) {
  const startTime = Date.now();
  const instanceErrors = new Set();

  // Ensure apis are available, fetch if not
  if (!apis) {
    await getapis();
    if (!apis) {
        throw new Error("APIリストの取得に失敗しました。");
    }
  }

  // Shuffle apis to distribute load and try different ones
  const shuffledApis = [...apis].sort(() => 0.5 - Math.random());

  for (const instance of shuffledApis) {
    try {
      const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: MAX_API_WAIT_TIME });
      console.log(`使ってみたURL: ${instance}/api/v1/videos/${videoId}`);

      if (response.data && response.data.formatStreams) {
        return response.data;
      } else {
        console.error(`formatStreamsが存在しない: ${instance}`);
      }
    } catch (error) {
      console.error(`エラーだよ: ${instance} - ${error.message}`);
      instanceErrors.add(instance);
    }

    if (Date.now() - startTime >= MAX_TIME) {
      throw new Error("接続がタイムアウトしました");
    }
  }

  throw new Error("動画を取得する方法が見つかりません");
}

// Routes
app.get('/', (req, res) => {
    res.sendStatus(200);
});

app.get('/data', (req, res) => {
    if (apis) {
        res.json(apis);
    } else {
        res.status(500).send('データを取得できていません');
    }
});

app.get('/refresh', async (req, res) => {
    await getapis();
    res.sendStatus(200);
});

app.get(['/api/:id', '/api/login/:id'], async (req, res) => {
  const videoId = req.params.id;
  try {
    const videoInfo = await ggvideo(videoId);

    // Prioritize high quality streams, then fall back to others
    const formatStreams = videoInfo.formatStreams || [];
    const streamUrl = formatStreams.reverse().map(stream => stream.url)[0]; // Simplistic, might need more robust logic

    const adaptiveFormats = videoInfo.adaptiveFormats || [];

    let highstreamUrl = adaptiveFormats
      .filter(stream => stream.container === 'webm' && stream.resolution === '1080p')
      .map(stream => stream.url)[0] || ''; // Ensure it's not undefined

    const audioUrl = adaptiveFormats
      .filter(stream => stream.container === 'm4a' && stream.audioQuality === 'AUDIO_QUALITY_MEDIUM')
      .map(stream => stream.url)[0] || ''; // Ensure it's not undefined

    const streamUrls = adaptiveFormats
      .filter(stream => stream.container === 'webm' && stream.resolution)
      .map(stream => ({
        url: stream.url,
        resolution: stream.resolution,
      }));

    const templateData = {
      stream_url: streamUrl,
      highstreamUrl: highstreamUrl,
      audioUrl: audioUrl,
      videoId: videoId,
      channelId: videoInfo.authorId,
      channelName: videoInfo.author,
      channelImage: videoInfo.authorThumbnails?.[videoInfo.authorThumbnails.length - 1]?.url || '',
      videoTitle: videoInfo.title,
      videoDes: videoInfo.descriptionHtml,
      videoViews: videoInfo.viewCount,
      likeCount: videoInfo.likeCount,
      streamUrls: streamUrls
    };

    res.json(templateData);
  } catch (error) {
        console.error(`動画情報取得エラー: ${error.message}`);
        res.status(500).json({
            error: '動画を取得できません',
            details: error.message
        });
  }
});

// Export the app for Vercel
module.exports = app;
