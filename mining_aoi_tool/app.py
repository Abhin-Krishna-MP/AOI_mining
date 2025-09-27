# Simple Flask app to serve a MapLibre-based UI and static GeoJSON outputs.
# Run: FLASK_APP=app.py flask run --host=0.0.0.0 --port=5000

from flask import Flask, send_from_directory, render_template, jsonify, request
import os
from dotenv import load_dotenv
load_dotenv()
print("Loaded OpenTopography API Key:", os.getenv("OPEN_TOPO_KEY"))

import subprocess

# --- DEM/3D Analysis dependencies ---
import tempfile, shutil, uuid
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from PIL import Image
from pathlib import Path
import requests

app = Flask(__name__, static_folder='static', template_folder='templates')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
STATIC_DIR = os.path.join(os.path.dirname(__file__), 'static')
os.makedirs(STATIC_DIR, exist_ok=True)
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


# --- DEM Upload & 3D Analysis Endpoint (ported from FastAPI) ---
def fetch_dem_opentopo(bounds, out_path, demtype="SRTMGL1"):
    """
    Fetch a DEM GeoTIFF from OpenTopography for the provided bounds.
    bounds: (left, bottom, right, top)
    out_path: path to write GeoTIFF
    demtype: dataset name (e.g., 'SRTMGL1', 'NASADEM_HGT')
    """
    OPEN_TOPO_KEY = os.getenv("OPEN_TOPO_KEY", None)
    OPEN_TOPO_URL = "https://portal.opentopography.org/API/globaldem"
    params = {
        "demtype": demtype,
        "south": bounds[1],
        "north": bounds[3],
        "west": bounds[0],
        "east": bounds[2],
        "outputFormat": "GTiff"
    }
    if OPEN_TOPO_KEY:
        params["API_Key"] = OPEN_TOPO_KEY
    print("[DEBUG] OpenTopography request URL:", OPEN_TOPO_URL)
    print("[DEBUG] OpenTopography request params:", params)
    r = requests.get(OPEN_TOPO_URL, params=params, stream=True)
    if r.status_code != 200:
        raise Exception(f"OpenTopography API error: {r.status_code} {r.text}")
    with open(out_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)

def normalize_to_png(arr, mask=None, vmin=None, vmax=None):
    valid = arr[~np.isnan(arr)]
    if vmin is None:
        vmin = float(valid.min())
    if vmax is None:
        vmax = float(valid.max())
    if vmax == vmin:
        vmax = vmin + 1.0
    norm = (arr - vmin) / (vmax - vmin)
    norm = np.clip(norm, 0.0, 1.0)
    img = (norm * 255).astype('uint8')
    if mask is not None:
        img[mask] = 0
    return img, vmin, vmax

from flask import send_file
from werkzeug.utils import secure_filename
@app.route('/upload-dem/', methods=['POST'])
def upload_dem():
    """
    Accepts a GeoTIFF upload (user's DEM). Fetches a current DEM over same bbox from OpenTopography,
    reprojects/resamples it to the user's grid, computes difference (current - user),
    writes a normalized PNG heightmap to /static and returns metrics + URL.
    """
    if 'file' not in request.files:
        return jsonify({"status": "error", "detail": "No file part in request."}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    if not filename.lower().endswith(('.tif', '.tiff')):
        return jsonify({"status": "error", "detail": "Please upload a GeoTIFF (.tif) file for MVP."}), 400
    tmpdir = tempfile.mkdtemp()
    try:
        user_path = os.path.join(tmpdir, filename)
        file.save(user_path)

        # Read user DEM
        with rasterio.open(user_path) as src:
            user_arr = src.read(1, masked=False).astype('float32')
            user_meta = src.meta.copy()
            user_bounds = src.bounds  # left, bottom, right, top
            user_transform = src.transform
            user_crs = src.crs
            user_width = src.width
            user_height = src.height
            user_nodata = src.nodata if src.nodata is not None else np.nan

        # Fetch current DEM from OpenTopography (writes to fetched.tif)
        fetched_path = os.path.join(tmpdir, "current_dem.tif")
        try:
            fetch_dem_opentopo((user_bounds.left, user_bounds.bottom, user_bounds.right, user_bounds.top), fetched_path)
        except Exception as e:
            return jsonify({"status": "error", "detail": f"Failed to fetch DEM from OpenTopography: {e}"}), 502

        # Reproject & resample fetched DEM to match user's grid
        with rasterio.open(fetched_path) as src:
            dst_arr = np.empty((user_height, user_width), dtype='float32')
            reproject(
                source=rasterio.band(src, 1),
                destination=dst_arr,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=user_transform,
                dst_crs=user_crs,
                resampling=Resampling.bilinear,
                dst_nodata=user_nodata
            )

        # Mask nodata
        user_mask = np.isnan(user_arr) | (user_arr == user_nodata)
        dst_mask = np.isnan(dst_arr) | (dst_arr == user_nodata)
        combined_mask = user_mask | dst_mask

        # Compute diff: current - user
        diff = dst_arr - user_arr
        diff_masked = np.ma.array(diff, mask=combined_mask)

        if diff_masked.size == 0 or diff_masked.count() == 0:
            return jsonify({"status": "error", "detail": "No overlapping valid pixels between uploaded DEM and fetched DEM."}), 400

        max_diff = float(diff_masked.max())
        min_diff = float(diff_masked.min())
        mean_diff = float(diff_masked.mean())

        # Approximate pixel area in m^2: only accurate if user CRS units are meters.
        try:
            pixel_width = abs(user_transform.a)
            pixel_height = abs(user_transform.e)
            pixel_area = pixel_width * pixel_height
            volume_m3 = float((diff_masked.filled(0)).sum() * pixel_area)
        except Exception:
            volume_m3 = None

        # Create normalized PNG for frontend displacement map
        png_arr, vmin, vmax = normalize_to_png(diff, mask=combined_mask)
        uid = uuid.uuid4().hex[:12]
        png_name = f"diff_{uid}.png"
        png_path = os.path.join(STATIC_DIR, png_name)
        Image.fromarray(png_arr).save(png_path)

        # Save metadata for scaling on frontend
        meta = {
            "min_diff": min_diff,
            "max_diff": max_diff,
            "vmin": vmin,
            "vmax": vmax,
            "width": user_width,
            "height": user_height,
            "pixel_area_m2": pixel_area if 'pixel_area' in locals() else None
        }
        meta_name = f"diff_{uid}.json"
        meta_path = os.path.join(STATIC_DIR, meta_name)
        with open(meta_path, "w") as mf:
            json.dump(meta, mf)

        return jsonify({
            "status": "success",
            "max_diff": max_diff,
            "min_diff": min_diff,
            "mean_diff": mean_diff,
            "volume_m3": volume_m3,
            "heightmap_url": f"/static/{png_name}",
            "meta_url": f"/static/{meta_name}"
        })

    finally:
        # keep tmpdir for debugging in dev; you may remove it in production
        pass


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
