# Simple Flask app to serve a MapLibre-based UI and static GeoJSON outputs.
# Run: FLASK_APP=app.py flask run --host=0.0.0.0 --port=5000
from flask import Flask, send_from_directory, render_template, jsonify, request
import os

import subprocess

app = Flask(__name__, static_folder='static', template_folder='templates')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
import json

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/data/<path:filename>')
def data_files(filename):
    # Ensure data directory exists
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    file_path = os.path.join(DATA_DIR, filename)
    if os.path.exists(file_path):
        return send_from_directory(DATA_DIR, filename)
    # Return valid empty GeoJSON or JSON if file is missing
    if filename.endswith('.geojson'):
        return jsonify({"type": "FeatureCollection", "features": []})
    if filename.endswith('.json'):
        return jsonify({})
    return '', 404


# Endpoint to accept AOI from frontend, save, and run detection
@app.route('/data/user_aoi', methods=['POST'])
def upload_user_aoi():
    geojson = request.get_json()
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    with open(os.path.join(DATA_DIR, 'user_aoi.geojson'), 'w') as f:
        import json
        json.dump(geojson, f)
    # Run detection script (blocking)
    try:
        subprocess.run(['python', 'detect_mining_aoi.py'], cwd=os.path.dirname(__file__), check=True)
        return jsonify({'status': 'ok', 'message': 'AOI updated and detection run'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# Serve comparison results for sidebar
@app.route('/data/comparison.json')
def comparison_json():
    try:
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR)
        with open(os.path.join(DATA_DIR, 'comparison.json')) as f:
            data = json.load(f)
        return jsonify(data)
    except Exception:
        # fallback: try to parse from detected_outside.geojson if available
        try:
            with open(os.path.join(DATA_DIR, 'comparison.json'), 'w') as f:
                json.dump({
                    "detected_area_m2": 0,
                    "outside_area_m2": 0,
                    "pct_outside": 0
                }, f)
        except Exception:
            pass
        return jsonify({
            "detected_area_m2": 0,
            "outside_area_m2": 0,
            "pct_outside": 0
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT',5000)))
