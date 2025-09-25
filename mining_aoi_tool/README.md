# Mining AOI Detection - Sentinel Hub Example (MVP)

This repository contains a minimal, ready-to-run MVP to detect disturbed/exposed-soil areas within a user-provided AOI using Sentinel-2 via Sentinel Hub Processing API.

## What it does
- Pulls recent Sentinel-2 L2A data for the provided AOI.
- Computes a simple SWIR−NIR index to highlight exposed soil / disturbed ground.
- Thresholds, denoises, polygonizes the result.
- Compares detected polygons to the user-provided AOI and writes polygons outside the AOI.
- Provides a tiny Flask UI (MapLibre) to visualize outputs.

## Quick start
1. Install Python 3.9+ and create a venv:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Set Sentinel Hub credentials (export env vars or create a .env):
   ```bash
   # Set your Sentinel Hub credentials from your environment (do not hardcode in code):
   export SH_CLIENT_ID=your_client_id
   export SH_CLIENT_SECRET=your_client_secret
   export SH_INSTANCE_ID=your_instance_id
   ```

3. Place your official AOI as `data/user_aoi.geojson` (EPSG:4326).

4. Run detection:
   ```bash
   python detect_mining_aoi.py
   ```

5. Start the Flask UI:
   ```bash
   FLASK_APP=app.py flask run --host=0.0.0.0 --port=5000
   ```
   Open http://localhost:5000 to view the map.

## Notes
- Tweak `IDX_THRESHOLD` and `MIN_SIZE_PIXELS` via environment variables for your region.
- Sentinel Hub free tier has usage limits; for production or daily high-res detection consider Planet or Maxar.
- This MVP is intentionally simple — for production, add authentication, queuing, PostGIS storage, and better classifiers.

## References
- Sentinel Hub Processing API & EvalScript: https://docs.sentinel-hub.com/
- sentinelhub-py examples and docs
