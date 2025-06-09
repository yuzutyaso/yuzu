// api/index.js
"use strict";
const express = require("express");
const compression = require("compression");
const cors = require('cors');
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr'); // ytsrをインポート

let app = express();

// ミドルウェアの適用
app.use(compression());
app.use(bodyParser.json());
app.use(cors());

// ヘルスチェック用ルート
app.get('/', (req, res) => {
    res.sendStatus(200);
});

// 検索エンドポイント
app.get('/api/search', async (req, res) => {
    const query = req.query.q; // クエリパラメータ 'q' から検索キーワードを取得

    if (!query) {
        return res.status(400).json({
            error: '検索キーワードが指定されていません。'
        });
    }

    try {
        const filters = await ytsr.get */('filters', query); // フィルタ情報を取得
        const filter = filters.get('Type').find(o => o.name === 'Video'); // 'Video'タイプに絞り込み
        const searchResults = await ytsr(filter.url || query, { pages: 1 }); // 検索を実行（1ページ目のみ）

        // 必要な情報のみを抽出して返す
        const videos = searchResults.items.filter(item => item.type === 'video').map(item => ({
            id: item.id,
            title: item.title,
            url: item.url,
            thumbnails: item.thumbnails,
            author: item.author ? item.author.name : 'Unknown',
            views: item.views,
            duration: item.duration
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


// /api/:id で動画情報を取得（既存のロジック）
app.get(['/api/:id', '/api/login/:id'], async (req, res) => {
    const videoId = req.params.id;

    if (!ytdl.validateID(videoId)) {
        return res.status(400).json({
            error: '無効なYouTube動画IDです。',
            details: '動画IDは11文字の英数字である必要があります。'
        });
    }

    try {
        const info = await ytdl.getInfo(videoId);

        const formatStreams = ytdl.filterFormats(info.formats, 'videoonly');
        const audioStreams = ytdl.filterFormats(info.formats, 'audioonly');

        const highResVideoFormat = formatStreams.find(f =>
            f.qualityLabel === '1080p' && f.container === 'webm' && f.hasVideo && !f.hasAudio
        );
        const highstreamUrl = highResVideoFormat ? highResVideoFormat.url : null;

        const combinedStreamUrl = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' }).url;

        const audioFormat = audioStreams.find(f => f.container === 'm4a' && f.audioQuality === 'AUDIO_QUALITY_MEDIUM');
        const audioUrl = audioFormat ? audioFormat.url : null;

        const availableStreamUrls = info.formats
            .filter(f => f.hasVideo && f.hasAudio && f.qualityLabel)
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))
            .map(f => ({
                url: f.url,
                resolution: f.qualityLabel,
                container: f.container
            }));

        const videoOnlyStreamUrls = formatStreams
            .filter(f => f.qualityLabel && f.hasVideo && !f.hasAudio)
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))
            .map(f => ({
                url: f.url,
                resolution: f.qualityLabel,
                container: f.container
            }));

        const templateData = {
            stream_url: combinedStreamUrl,
            highstreamUrl: highstreamUrl,
            audioUrl: audioUrl,
            videoId: videoId,
            channelId: info.videoDetails.ownerProfileUrl ? info.videoDetails.ownerProfileUrl.split('/').pop() : '',
            channelName: info.videoDetails.ownerChannelName,
            channelImage: info.videoDetails.author.thumbnails?.[info.videoDetails.author.thumbnails.length - 1]?.url || '',
            videoTitle: info.videoDetails.title,
            videoDes: info.videoDetails.description,
            videoViews: info.videoDetails.viewCount,
            likeCount: info.videoDetails.likes,
            streamUrls: availableStreamUrls,
            videoOnlyStreamUrls: videoOnlyStreamUrls
        };

        res.json(templateData);

    } catch (error) {
        console.error(`動画情報取得エラー (${videoId}):`, error.message);
        let errorMessage = '動画情報を取得できませんでした。';
        if (error.message.includes('No video formats found')) {
            errorMessage = 'この動画は利用できないか、再生できない形式です。';
        } else if (error.message.includes('private')) {
            errorMessage = 'この動画はプライベート設定です。';
        } else if (error.message.includes('unavailable')) {
            errorMessage = 'この動画は利用できません。';
        } else if (error.message.includes('not found')) {
             errorMessage = '指定された動画IDの動画は見つかりませんでした。';
        }
        res.status(500).json({
            error: errorMessage,
            details: error.message
        });
    }
});

// VercelでExpressアプリをエクスポート
module.exports = app;
