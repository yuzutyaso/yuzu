// api/index.js
"use strict";
const express = require("express");
const compression = require("compression");
const cors = require('cors');
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core'); // ytdl-coreをインポート

let app = express();

// ミドルウェアの適用
app.use(compression());
app.use(bodyParser.json());
app.use(cors());

// ルート定義
app.get('/', (req, res) => {
    // Vercelがヘルスチェックに使うため、200 OKを返す
    res.sendStatus(200);
});

// /api/:id または /api/login/:id で動画情報を取得
app.get(['/api/:id', '/api/login/:id'], async (req, res) => {
    const videoId = req.params.id;

    // YouTube動画IDの基本的なバリデーション
    if (!ytdl.validateID(videoId)) {
        return res.status(400).json({
            error: '無効なYouTube動画IDです。',
            details: '動画IDは11文字の英数字である必要があります。'
        });
    }

    try {
        // ytdl-coreで動画情報を取得
        const info = await ytdl.getInfo(videoId);

        // 必要に応じて、動画と音声のストリームをフィルタリング
        // ここでは、動画のみの高品質なストリームと、音声のみのストリームを取得する例
        const formatStreams = ytdl.filterFormats(info.formats, 'videoonly');
        const audioStreams = ytdl.filterFormats(info.formats, 'audioonly');

        // ストリームURLの選択ロジックを調整
        // 高品質な動画ストリーム（例: 1080p WebM）
        const highResVideoFormat = formatStreams.find(f =>
            f.qualityLabel === '1080p' && f.container === 'webm' && f.hasVideo && !f.hasAudio
        );
        const highstreamUrl = highResVideoFormat ? highResVideoFormat.url : null;

        // 利用可能な最も高い解像度のストリーム（動画+音声）
        // ytdl-coreは通常、結合されたストリームは提供しないので、動画のみを選ぶ
        const combinedStreamUrl = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' }).url;


        // 音声ストリーム（例: m4a）
        const audioFormat = audioStreams.find(f => f.container === 'm4a' && f.audioQuality === 'AUDIO_QUALITY_MEDIUM');
        const audioUrl = audioFormat ? audioFormat.url : null;

        // 利用可能な全ストリーム情報 (フロントエンドの品質選択用)
        const availableStreamUrls = info.formats
            .filter(f => f.hasVideo && f.hasAudio && f.qualityLabel) // 動画と音声があり、品質ラベルがあるもの
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel)) // 解像度で降順ソート
            .map(f => ({
                url: f.url,
                resolution: f.qualityLabel,
                container: f.container
            }));

        // 動画のみのストリーム（解像度選択用）
        const videoOnlyStreamUrls = formatStreams
            .filter(f => f.qualityLabel && f.hasVideo && !f.hasAudio)
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))
            .map(f => ({
                url: f.url,
                resolution: f.qualityLabel,
                container: f.container
            }));

        const templateData = {
            // 基本的にはcombinedStreamUrlをデフォルトとするが、
            // フロントエンドで動画+音声の品質選択を実装するならその選択肢も提示
            stream_url: combinedStreamUrl, // 結合されたストリーム (通常、最高品質の動画ストリームを選ぶことが多い)
            highstreamUrl: highstreamUrl, // 1080pの動画のみストリーム
            audioUrl: audioUrl,           // 音声のみストリーム
            videoId: videoId,
            channelId: info.videoDetails.ownerProfileUrl ? info.videoDetails.ownerProfileUrl.split('/').pop() : '',
            channelName: info.videoDetails.ownerChannelName,
            channelImage: info.videoDetails.author.thumbnails?.[info.videoDetails.author.thumbnails.length - 1]?.url || '',
            videoTitle: info.videoDetails.title,
            videoDes: info.videoDetails.description, // HTML形式ではない可能性があるので注意
            videoViews: info.videoDetails.viewCount,
            likeCount: info.videoDetails.likes,
            streamUrls: availableStreamUrls, // 動画+音声の全ストリーム（品質選択用）
            videoOnlyStreamUrls: videoOnlyStreamUrls // 動画のみの全ストリーム（品質選択用）
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
