// api/index.js
"use strict";
const express = require("express");
const compression = require("compression");
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); // axiosをインポート

let app = express();

// ミドルウェアの適用
app.use(compression());
app.use(bodyParser.json());
app.use(cors());

// --- Invidious インスタンスリストと管理 ---
// 動作が確認されているInvidiousインスタンスのリスト
// 定期的に更新されるインスタンスリストAPIから取得することも可能ですが、
// シンプルさのためここでは固定リストで管理します。
// 動作しなくなったらここを更新してください。
let invidiousInstances = [
  'https://lekker.gay',
];
const INSTANCE_CHECK_TIMEOUT = 5000; // インスタンスチェックのタイムアウト (ms)
const MAX_REQUEST_TIMEOUT = 10000; // APIリクエスト全体のタイムアウト (ms)

// ランダムなInvidiousインスタンスを取得するヘルパー関数
async function getRandomInstance() {
    // 応答可能なインスタンスを見つけるまで試す
    for (let i = 0; i < invidiousInstances.length; i++) {
        const instance = invidiousInstances[Math.floor(Math.random() * invidiousInstances.length)];
        try {
            // シンプルなヘルスチェック
            await axios.get(`${instance}/api/v1/health`, { timeout: INSTANCE_CHECK_TIMEOUT });
            return instance;
        } catch (error) {
            console.warn(`Invidiousインスタンス ${instance} が応答しません。別のインスタンスを試します。`);
            // エラーが発生したインスタンスを一時的にリストから削除することも検討できますが、
            // シンプルさのためここでは行いません。
        }
    }
    throw new Error('利用可能なInvidiousインスタンスが見つかりません。');
}

// ヘルスチェック用ルート
app.get('/', (req, res) => {
    res.sendStatus(200);
});

// 検索エンドポイント
app.get('/api/search', async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({
            error: '検索キーワードが指定されていません。'
        });
    }

    try {
        const instance = await getRandomInstance();
        console.log(`検索に利用するInvidiousインスタンス: ${instance}`);

        const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const response = await axios.get(searchUrl, { timeout: MAX_REQUEST_TIMEOUT });

        // Invidiousの検索結果から必要な情報のみを抽出
        const videos = response.data.map(item => ({
            id: item.videoId,
            title: item.title,
            url: `${instance}/watch?v=${item.videoId}`, // Invidiousの動画URL
            thumbnails: item.videoThumbnails.map(thumb => ({ url: thumb.url, width: thumb.width, height: thumb.height })),
            author: item.author,
            views: item.viewCount,
            duration: item.lengthSeconds ? formatDuration(item.lengthSeconds) : 'N/A' // 秒数を 'MM:SS' 形式に変換
        }));

        res.json(videos);
    } catch (error) {
        console.error(`検索エラー (${query}):`, error.message);
        res.status(500).json({
            error: '動画の検索に失敗しました。',
            details: error.message
        });
    }
});

// 動画情報取得エンドポイント
app.get(['/api/:id', '/api/login/:id'], async (req, res) => {
    const videoId = req.params.id;

    // 簡単な動画IDのバリデーション
    if (!videoId || typeof videoId !== 'string' || videoId.length !== 11) {
        return res.status(400).json({
            error: '無効なYouTube動画IDです。',
            details: '動画IDは11文字の英数字である必要があります。'
        });
    }

    try {
        const instance = await getRandomInstance();
        console.log(`動画情報取得に利用するInvidiousインスタンス: ${instance}`);

        const videoUrl = `${instance}/api/v1/videos/${videoId}`;
        const response = await axios.get(videoUrl, { timeout: MAX_REQUEST_TIMEOUT });
        const videoInfo = response.data;

        // ストリームURLの選択ロジック
        // Invidious APIは通常、直接の動画URLを提供します。
        // ここでは、最高品質の動画+音声ストリーム、高解像度動画のみ、音声のみを抽出します。

        // 最も品質の高い動画+音声ストリーム
        const combinedStream = videoInfo.formatStreams
            .filter(f => f.quality === 'medium' && f.url) // 'medium'はInvidious APIの一般的な品質
            .sort((a,b) => b.bitrate - a.bitrate)[0]; // 最高ビットレートを選ぶ
        const stream_url = combinedStream ? combinedStream.url : null;

        // 1080pの動画のみストリーム (もしあれば)
        const highResVideo = videoInfo.formatStreams
            .filter(f => f.quality === '1080p' && f.url && f.container === 'webm' && f.videoOnly)[0];
        const highstreamUrl = highResVideo ? highResVideo.url : null;

        // 音声のみストリーム (m4a)
        const audioStream = videoInfo.adaptiveFormats
            .filter(f => f.container === 'm4a' && f.url)[0];
        const audioUrl = audioStream ? audioStream.url : null;

        // フロントエンドの品質選択用 (動画+音声)
        const availableStreamUrls = videoInfo.formatStreams
            .filter(f => f.url && f.qualityLabel)
            .map(f => ({
                url: f.url,
                resolution: f.qualityLabel,
                container: f.container
            }));

        // フロントエンドの品質選択用 (動画のみ)
        const videoOnlyStreamUrls = videoInfo.adaptiveFormats
            .filter(f => f.url && f.qualityLabel && f.videoOnly)
            .map(f => ({
                url: f.url,
                resolution: f.qualityLabel,
                container: f.container
            }));


        const templateData = {
            stream_url: stream_url,
            highstreamUrl: highstreamUrl,
            audioUrl: audioUrl,
            videoId: videoId,
            channelId: videoInfo.authorId,
            channelName: videoInfo.author,
            channelImage: videoInfo.authorThumbnails?.[videoInfo.authorThumbnails.length - 1]?.url || '',
            videoTitle: videoInfo.title,
            videoDes: videoInfo.description, // Invidiousは通常HTMLではない
            videoViews: videoInfo.viewCount,
            likeCount: videoInfo.likeCount,
            streamUrls: availableStreamUrls,
            videoOnlyStreamUrls: videoOnlyStreamUrls // フロントエンドで利用するため追加
        };

        res.json(templateData);

    } catch (error) {
        console.error(`動画情報取得エラー (${videoId}):`, error.message);
        let errorMessage = '動画情報を取得できませんでした。';
        if (error.response && error.response.status === 404) {
            errorMessage = '指定された動画は見つかりませんでした。';
        } else if (error.message.includes('unavailable') || error.message.includes('private')) {
            errorMessage = 'この動画は利用できないか、プライベート設定です。';
        }
        res.status(500).json({
            error: errorMessage,
            details: error.message
        });
    }
});

// 秒数を "MM:SS" 形式に変換するヘルパー関数
function formatDuration(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const paddedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${minutes}:${paddedSeconds}`;
}

// VercelでExpressアプリをエクスポート
module.exports = app;
