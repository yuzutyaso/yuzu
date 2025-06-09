document.addEventListener('DOMContentLoaded', () => {
    const youtubeUrlInput = document.getElementById('youtube-url');
    const loadVideoButton = document.getElementById('load-video');
    const searchQueryInput = document.getElementById('search-query'); // 追加
    const searchVideoButton = document.getElementById('search-video'); // 追加
    const searchResultsDiv = document.getElementById('search-results'); // 追加

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
        return parseInt(num).toLocaleString();
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
        errorMessage.textContent = ''; // エラーメッセージもクリア
    }

    // 特定の動画IDで動画情報を読み込む関数
    async function loadVideoById(videoId) {
        resetVideoInfo(); // まず表示をクリア

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
            videoDescription.innerHTML = data.videoDes ? data.videoDes.replace(/\n/g, '<br>') : '説明なし';
            if (data.channelImage) {
                channelImage.src = data.channelImage;
                channelImage.style.display = 'inline-block';
            } else {
                channelImage.style.display = 'none';
            }

            // 品質選択ボタンを生成
            qualitySelector.innerHTML = '';
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

            if (data.highstreamUrl) {
                const highResButton = document.createElement('button');
                highResButton.textContent = '1080p (動画のみ)';
                highResButton.dataset.url = data.highstreamUrl;
                highResButton.dataset.type = 'video-only';
                qualitySelector.appendChild(highResButton);
            }

            data.videoOnlyStreamUrls.forEach(stream => {
                if (stream.url !== data.highstreamUrl && stream.resolution && stream.url) {
                    const button = document.createElement('button');
                    button.textContent = `${stream.resolution} (動画のみ)`;
                    button.dataset.url = stream.url;
                    button.dataset.type = 'video-only';
                    qualitySelector.appendChild(button);
                }
            });

            if (data.audioUrl) {
                const audioButton = document.createElement('button');
                audioButton.textContent = '音声のみ';
                audioButton.dataset.url = data.audioUrl;
                audioButton.dataset.type = 'audio-only';
                qualitySelector.appendChild(audioButton);
            }

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
            resetVideoInfo(); // エラー時はすべてクリア
        }
    }

    // URL入力ボタンのイベントリスナー（既存）
    loadVideoButton.addEventListener('click', async () => {
        const fullUrl = youtubeUrlInput.value;
        if (!fullUrl) {
            errorMessage.textContent = 'YouTubeのURLを入力してください。';
            return;
        }

        let videoId;
        try {
            const url = new URL(fullUrl);
            if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
                if (url.hostname.includes('youtube.com')) {
                    videoId = url.searchParams.get('v');
                } else if (url.hostname.includes('youtu.be')) {
                    videoId = url.pathname.substring(1);
                }
            } else {
                videoId = fullUrl.match(/^[a-zA-Z0-9_-]{11}$/) ? fullUrl : null; // 直接ID入力の場合
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

    // 検索ボタンのイベントリスナー（新規）
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
                itemDiv.dataset.videoId = video.id; // 動画IDをカスタムデータ属性として保存

                itemDiv.innerHTML = `
                    <img src="${video.thumbnails ? video.thumbnails[0].url : ''}" alt="${video.title}">
                    <div class="search-result-info">
                        <h3>${video.title}</h3>
                        <p>チャンネル: ${video.author}</p>
                        <p>再生回数: ${formatNumber(video.views || 0)}</p>
                        <p class="duration">時間: ${video.duration || 'N/A'}</p>
                    </div>
                `;
                searchResultsDiv.appendChild(itemDiv);

                // 検索結果アイテムクリックで動画を読み込む
                itemDiv.addEventListener('click', () => {
                    loadVideoById(video.id);
                    // 検索結果をクリアして、検索クエリをURL欄にコピー（任意）
                    youtubeUrlInput.value = video.url;
                    searchResultsDiv.innerHTML = '';
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
