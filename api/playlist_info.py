# api/playlist_info.py
from flask import Flask, request, jsonify
import ytpl

app = Flask(__name__)

@app.route('/api/playlist_info')
def playlist_info():
    playlist_id = request.args.get('id', '')
    if not playlist_id:
        return jsonify({"error": "プレイリストIDが必要です"}), 400

    try:
        # プレイリストのURLを指定
        playlist = ytpl.parse_playlist(f'https://www.youtube.com/playlist?list={playlist_id}')
        videos = []
        for item in playlist.get('items', []):
            videos.append({
                'id': item.get('id'),
                'title': item.get('title'),
                'thumbnailUrl': item.get('thumbnails', [{}])[-1].get('url') if item.get('thumbnails') else None # 最大解像度のサムネイル
            })
        return jsonify({
            'id': playlist.get('id'),
            'title': playlist.get('title'),
            'author': playlist.get('author'),
            'videoCount': playlist.get('video_count'),
            'videos': videos
        })
    except Exception as e:
        print(f"Error in playlist_info API: {e}")
        return jsonify({"error": "プレイリスト情報の取得に失敗しました。"}), 500

if __name__ == '__main__':
    app.run(debug=True)
