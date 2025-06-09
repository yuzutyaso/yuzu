# api/search.py
from flask import Flask, request, jsonify
from ytsr import search as ytsr_search

app = Flask(__name__)

@app.route('/api/search')
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({"error": "検索クエリが必要です"}), 400

    try:
        results = ytsr_search(query)
        videos = []
        for item in results['results']:
            # ytsr の結果から必要な情報を抽出
            # サムネイルは 'thumbnails' リストの最初の要素の 'url' を使うことが多い
            thumbnail_url = item.get('thumbnails', [{}])[0].get('url') if item.get('thumbnails') else None
            
            # YouTube動画として有効なIDがあるか確認
            if item.get('type') == 'video' and item.get('id') and item.get('title') and thumbnail_url:
                videos.append({
                    'id': item['id'],
                    'title': item['title'],
                    'thumbnailUrl': thumbnail_url
                })
        return jsonify(videos)
    except Exception as e:
        print(f"Error in search API: {e}") # デバッグ用にエラーを出力
        return jsonify({"error": "検索結果の取得に失敗しました。"}), 500

if __name__ == '__main__':
    app.run(debug=True)
