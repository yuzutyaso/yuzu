document.addEventListener('DOMContentLoaded', () => {
    const youtubeUrlInput = document.getElementById('youtube-url');
    const loadVideoButton = document.getElementById('load-video');
    const searchQueryInput = document.getElementById('search-query');
    const searchVideoButton = document.getElementById('search-video');
    const searchResultsDiv = document.getElementById('search-results');

    const videoElement = document.getElementById('video-element');
    const videoTitle = document.getElementById('video-title');
    const channelName = document.getElementById('channel-name');
    const videoViews = document.getElementById('video-views');
    const likeCount = document.getElementById('like-count');
    const videoDescription = document.getElementById('video-description');
    const channelImage = document.getElementById('channel-image');
    const errorMessage = document.getElementById('error-message');
    const qualitySelector = document.getElementById('quality-selector');

    // 数値をカンマ区切りでフォーマットするヘルパー関数
    const formatNumber = (num) => {
        if (num === null || num === undefined) return 'N/A';
        // 数値でない場合は文字列を解析して数値に変換
        if (typeof num === 'string') {
            num = parseInt(num.replace(/,/g, ''), 10);
            if (isNaN(num)) return 'N/A';
        }
        return num.toLocaleString();
    };

    // 動画情報をリセットするヘルパー関数
    function resetVideoInfo() {
        videoElement.src = '';
        videoElement.load();
        videoTitle.textContent = '';
        channelName.textContent = '';
        videoViews.textContent = '';
        likeCount.textContent = '';
        videoDescription.innerHTML = '';
        channelImage.src = '';
        channelImage.style.display = 'none';
        qualitySelector.innerHTML = '';
        errorMessage.textContent = '';
    }

    // 特定の動画IDで動画情報を読み込む関数
    async function loadVideoById(videoId) {
        resetVideoInfo(); // まず表示をクリア
        searchResultsDiv.innerHTML = ''; // 検索結果もクリア

        try {
            const response = await fetch(`/api/${videoId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.details || '動画情報の取得に失敗しました。');
            }
            const data = await response.json();
            console.log("Fetched video data:", data);

            videoTitle.textContent = data.videoTitle || 'タイトルなし';
            channelName.textContent = data.channelName || '不明なチャンネル';
            videoViews.textContent = formatNumber(data.videoViews);
            likeCount.textContent = formatNumber(data.likeCount);
            // Invidiousのdescriptionは改行コードが含まれる場合があるので変換
            videoDescription.innerHTML = data.videoDes ? data.videoDes.replace(/\n/g, '<br>') : '説明なし';
            if (data.channelImage) {
                channelImage.src = data.channelImage;
                channelImage.style.display = 'inline-block';
            } else {
                channelImage.style.display = 'none';
            }

            // 品質選択ボタンを生成
            qualitySelector.innerHTML = '';
            // デフォルトのストリームを設定
            if (data.stream_url) {
                videoElement.src = data.stream_url;
                videoElement.load();
                const defaultButton = document.createElement('button');
                defaultButton.textContent = '自動 (推奨)';
                defaultButton.dataset.url = data.stream_url;
                defaultButton.dataset.type = 'combined';
                defaultButton.classList.add('active');
                qualitySelector.appendChild(defaultButton);
            }

            // 1080pの動画のみストリームがあれば追加
            if (data.highstreamUrl) {
                const highResButton = document.createElement('button');
                highResButton.textContent = '1080p (動画のみ)';
                highResButton.dataset.url = data.highstreamUrl;
                highResButton.dataset.type = 'video-only';
                qualitySelector.appendChild(highResButton);
            }

            // その他の動画のみの解像度ストリームがあれば追加
            // uniqueな解像度を保持
            const uniqueVideoOnlyQualities = new Set();
            data.videoOnlyStreamUrls.forEach(stream => {
                // 既に1080pボタンがあれば追加しない
                if (stream.resolution === '1080p' && data.highstreamUrl) return;
                // 重複する解像度を追加しない
                if (uniqueVideoOnlyQualities.has(stream.resolution)) return;

                if (stream.url && stream.resolution) {
                    const button = document.createElement('button');
                    button.textContent = `${stream.resolution} (動画のみ)`;
                    button.dataset.url = stream.url;
                    button.dataset.type = 'video-only';
                    qualitySelector.appendChild(button);
                    uniqueVideoOnlyQualities.add(stream.resolution);
                }
            });


            // 音声のみストリームがあれば追加
            if (data.audioUrl) {
                const audioButton = document.createElement('button');
                audioButton.textContent = '音声のみ';
                audioButton.dataset.url = data.audioUrl;
                audioButton.dataset.type = 'audio-only';
                qualitySelector.appendChild(audioButton);
            }

            // 品質ボタンのクリックイベントリスナー
            qualitySelector.addEventListener('click', (event) => {
                if (event.target.tagName === 'BUTTON') {
                    const selectedUrl = event.target.dataset.url;
                    Array.from(qualitySelector.children).forEach(btn => btn.classList.remove('active'));
                    event.target.classList.add('active');
                    if (selectedUrl) {
                        videoElement.src = selectedUrl;
                        videoElement.load();
                        videoElement.play().catch(e => console.error("再生エラー:", e));
                    } else {
                        errorMessage.textContent = '選択された品質のストリームURLが見つかりません。';
                    }
                }
            });

        } catch (error) {
            errorMessage.textContent = `エラー: ${error.message}`;
            console.error('動画情報の取得に失敗しました:', error);
            resetVideoInfo();
        }
    }

    // URL入力ボタンのイベントリスナー
    loadVideoButton.addEventListener('click', async () => {
        const fullUrl = youtubeUrlInput.value;
        if (!fullUrl) {
            errorMessage.textContent = 'YouTubeのURLを入力してください。';
            return;
        }

        let videoId;
        try {
            const url = new URL(fullUrl);
            // YouTubeの標準的なURL形式に対応
            if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v');
            } else if (url.hostname.includes('youtu.be')) { // youtu.be 短縮URL
                videoId = url.pathname.substring(1);
            } else {
                // 直接動画IDが入力された場合や、InvidiousインスタンスのURLの場合も考慮
                videoId = fullUrl.match(/^[a-zA-Z0-9_-]{11}$/) ? fullUrl : null;
                // Invidious URLから動画IDを抽出
                if (!videoId) {
                    const invidiousMatch = fullUrl.match(/^(?:https?:\/\/[a-zA-Z0-9.-]+\/watch\?v=|https?:\/\/[a-zA-Z0-9.-]+\/latest\/)?([a-zA-Z0-9_-]{11})$/);
                    if (invidiousMatch) {
                        videoId = invidiousMatch[1];
                    }
                }
            }

            if (!videoId) {
                errorMessage.textContent = '有効なYouTube動画URLまたは動画IDではありません。';
                return;
            }
        } catch (e) {
            errorMessage.textContent = 'URLの解析に失敗しました。正しいURLを入力してください。';
            return;
        }
        loadVideoById(videoId); // 動画IDで読み込む関数を呼び出す
    });

    // 検索ボタンのイベントリスナー
    searchVideoButton.addEventListener('click', async () => {
        const query = searchQueryInput.value.trim();
        if (!query) {
            errorMessage.textContent = '検索キーワードを入力してください。';
            return;
        }

        resetVideoInfo(); // 動画表示とエラーメッセージをクリア
        searchResultsDiv.innerHTML = '検索中...'; // 検索中表示

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '検索に失敗しました。');
            }
            const videos = await response.json();
            console.log("Search results:", videos);

            searchResultsDiv.innerHTML = ''; // 検索中表示をクリア

            if (videos.length === 0) {
                searchResultsDiv.textContent = '検索結果が見つかりませんでした。';
                return;
            }

            // 検索結果を表示
            videos.forEach(video => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('search-result-item');
                itemDiv.dataset.videoId = video.id;

                // サムネイルURLをより確実に取得する（配列の最初の要素など）
                const thumbnailUrl = video.thumbnails && video.thumbnails.length > 0 ? video.thumbnails[0].url : '';

                itemDiv.innerHTML = `
                    <img src="${thumbnailUrl}" alt="${video.title}">
                    <div class="search-result-info">
                        <h3>${video.title}</h3>
                        <p>チャンネル: ${video.author}</p>
                        <p>再生回数: ${formatNumber(video.views || 0)}</p>
                        <p class="duration">時間: ${video.duration || 'N/A'}</p>
                    </div>
                `;
                searchResultsDiv.appendChild(itemDiv);

                itemDiv.addEventListener('click', () => {
                    loadVideoById(video.id);
                    // 検索結果をクリアして、検索クエリをURL欄にコピー（任意）
                    youtubeUrlInput.value = `youtube.com?v=${video.id}`; // 標準YouTube URLとして表示
                    searchResultsDiv.innerHTML = ''; // 検索結果を非表示
                });
            });

        } catch (error) {
            errorMessage.textContent = `検索エラー: ${error.message}`;
            console.error('動画の検索に失敗しました:', error);
            searchResultsDiv.innerHTML = ''; // 検索中表示をクリア
        }
    });

    // 初期化時に動画情報をクリア
    resetVideoInfo();
});
