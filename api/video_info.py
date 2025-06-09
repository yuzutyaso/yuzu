# api/video_info.py
from flask import Flask, request, jsonify
import yt_dlp

app = Flask(__name__)

@app.route('/api/video_info')
def video_info():
    video_id = request.args.get('id', '')
    if not video_id:
        return jsonify({"error": "動画IDが必要です"}), 400

    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'noplaylist': True,
        'extract_flat': True,
        'dump_single_json': True,
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # YouTubeのURLを指定
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            
            # 必要な情報のみを抽出して返す
            return jsonify({
                'id': info.get('id'),
                'title': info.get('title'),
                'description': info.get('description'),
                'thumbnailUrl': info.get('thumbnail'),
                'uploader': info.get('uploader'),
                'duration': info.get('duration'), # 秒単位
                'viewCount': info.get('view_count'),
                'uploadDate': info.get('upload_date'), # YYYYMMDD形式
            })
    except Exception as e:
        print(f"Error in video_info API: {e}")
        return jsonify({"error": "動画情報の取得に失敗しました。"}), 500

if __name__ == '__main__':
    app.run(debug=True)
