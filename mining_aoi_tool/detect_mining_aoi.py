# detect_mining_aoi.py
# Replace environment variables or set them before running:
# export SH_CLIENT_ID="your_client_id"
# export SH_CLIENT_SECRET="your_client_secret"
# export SH_INSTANCE_ID="your_instance_id"
#
# Usage:
# 1) Put your user AOI as data/user_aoi.geojson (WGS84 / EPSG:4326).
# 2) Run: python detect_mining_aoi.py
#
# Outputs:
# - data/detected_polygons.geojson
# - data/detected_outside.geojson

import os
from dotenv import load_dotenv
from sentinelhub import SHConfig, BBox, CRS, bbox_to_dimensions, SentinelHubRequest, DataCollection, MimeType
import geopandas as gpd
import numpy as np
from shapely.geometry import shape
from rasterio.features import shapes
from skimage.morphology import remove_small_objects, binary_closing, binary_opening, disk
from skimage import img_as_bool
import warnings
import rasterio
from rasterio.transform import from_bounds

warnings.filterwarnings('ignore')


# Load environment variables from .env file if present
load_dotenv()

# CONFIG - read from environment variables (recommended)
config = SHConfig()
config.sh_client_id = os.getenv('SH_CLIENT_ID', 'YOUR_CLIENT_ID')
config.sh_client_secret = os.getenv('SH_CLIENT_SECRET', 'YOUR_CLIENT_SECRET')
config.instance_id = os.getenv('SH_INSTANCE_ID', 'YOUR_INSTANCE_ID')

# Basic check
if ('YOUR_CLIENT_ID' in config.sh_client_id) or ('YOUR_CLIENT_SECRET' in config.sh_client_secret) or ('YOUR_INSTANCE_ID' in config.instance_id):
    print("WARNING: Sentinel Hub credentials are not set. Please set SH_CLIENT_ID, SH_CLIENT_SECRET, and SH_INSTANCE_ID environment variables.")
    # The script will still attempt to run but will fail to authenticate.

# Ensure data folder exists
os.makedirs('data', exist_ok=True)

# Load user AOI
try:
    user_aoi = gpd.read_file('data/user_aoi.geojson').to_crs(epsg=4326)
except Exception as e:
    print('ERROR: Could not read data/user_aoi.geojson. Ensure the file exists and is valid GeoJSON in EPSG:4326.')
    raise


aoi_geom = user_aoi.unary_union
minx, miny, maxx, maxy = aoi_geom.bounds
# Expand bbox by 10% in all directions
expand_x = (maxx - minx) * 0.1
expand_y = (maxy - miny) * 0.1
minx_exp = minx - expand_x
maxx_exp = maxx + expand_x
miny_exp = miny - expand_y
maxy_exp = maxy + expand_y
bbox = BBox([minx_exp, miny_exp, maxx_exp, maxy_exp], crs=CRS.WGS84)


# choose resolution (10m for Sentinel-2)
resolution = 10
size = bbox_to_dimensions(bbox, resolution=resolution)
# Cap the output image size to Sentinel Hub API max (2500x2500)
max_dim = 2500
size = (min(size[0], max_dim), min(size[1], max_dim))

# Evalscript inline (same as evalscript_mining_v3.js)
evalscript = """//VERSION=3
function setup() {
  return {
    input: [{"bands":["B04","B08","B11","dataMask"]}],
    output: {bands:4, sampleType:"FLOAT32"}
  };
}
function evaluatePixel(sample) {
  return [sample.B04, sample.B08, sample.B11, sample.dataMask];
}"""

request = SentinelHubRequest(
    evalscript=evalscript,
    input_data=[SentinelHubRequest.input_data(
        data_collection=DataCollection.SENTINEL2_L2A,
        time_interval=(os.getenv('TIME_START','2025-09-01'), os.getenv('TIME_END','2025-09-25')),
        mosaicking_order='mostRecent'
    )],
    responses=[SentinelHubRequest.output_response('default', MimeType.TIFF)],
    bbox=bbox,
    size=size,
    config=config
)

print('Requesting data from Sentinel Hub (this may take some seconds)...')
img = request.get_data()[0]  # H,W,4

# Compute soil proxy index: (SWIR - NIR)/(SWIR + NIR)
red = img[:, :, 0].astype(float)
nir = img[:, :, 1].astype(float)
swir = img[:, :, 2].astype(float)
data_mask = img[:, :, 3] > 0

idx = (swir - nir) / (swir + nir + 1e-6)

# --- Diagnostic: save raw index to GeoTIFF ---

transform = from_bounds(minx, miny, maxx, maxy, idx.shape[1], idx.shape[0])
with rasterio.open(
    'data/index_raw.tif',
    'w',
    driver='GTiff',
    height=idx.shape[0],
    width=idx.shape[1],
    count=1,
    dtype=idx.dtype,
    crs='EPSG:4326',
    transform=transform
) as dst:
    dst.write(idx, 1)

print("Saved raw index as data/index_raw.tif")
# --- End Diagnostic ---

# Threshold - start with 0.05 (tune per site)
mask = (idx > float(os.getenv('IDX_THRESHOLD','0.05'))) & data_mask


# Morphological clean-up
mask_bool = img_as_bool(mask)
mask_clean = binary_opening(mask_bool, disk(1))
mask_clean = binary_closing(mask_clean, disk(2))
mask_clean = remove_small_objects(mask_clean, min_size=int(os.getenv('MIN_SIZE_PIXELS', '100')))  # default 100 pixels

# If mask_clean is empty, we still want to create empty GeoJSONs later
if not mask_clean.any():
    print("No detections in mask (mask is empty). Writing empty outputs.")
    gpd.GeoSeries([], crs='EPSG:4326').to_file('data/detected_polygons.geojson', driver='GeoJSON')
    gpd.GeoSeries([], crs='EPSG:4326').to_file('data/detected_outside.geojson', driver='GeoJSON')
    print('Saved data/detected_polygons.geojson and data/detected_outside.geojson (empty)')
    exit(0)

# ------------------ Compute affine transform and polygonize ------------------
from rasterio.transform import from_bounds
height, width = mask_clean.shape
transform = from_bounds(minx, miny, maxx, maxy, width, height)

polys = []
for geom, val in shapes(mask_clean.astype('uint8'), mask=mask_clean.astype('uint8'), transform=transform):
    if val == 1:
        polys.append(shape(geom))

# The polygons are in EPSG:4326 because transform uses lon/lat bbox
detected_gdf = gpd.GeoDataFrame(geometry=polys, crs='EPSG:4326')

# Combine and compute areas in metric CRS
detected_union = detected_gdf.unary_union
detected_g = gpd.GeoSeries([detected_union], crs='EPSG:4326')
detected_m = detected_g.to_crs(epsg=3857)
detected_area_m2 = float(detected_m.geometry[0].area) if not detected_m.is_empty.all() else 0.0

user_union = user_aoi.unary_union
user_g = gpd.GeoSeries([user_union], crs='EPSG:4326').to_crs(epsg=3857)

outside = gpd.GeoSeries([detected_union.difference(user_union)], crs='EPSG:4326').to_crs(epsg=3857)
outside_area_m2 = float(outside.geometry[0].area) if not outside.is_empty.all() else 0.0
pct_outside = 100 * outside_area_m2 / (detected_area_m2 + 1e-9) if detected_area_m2 > 0 else 0.0


print(f"Detected area: {detected_area_m2:.0f} m², Outside lease: {outside_area_m2:.0f} m² ({pct_outside:.2f}%)")

# Write comparison results for frontend sidebar
import json
time_start = os.getenv('TIME_START', '2025-09-01')
time_end = os.getenv('TIME_END', '2025-09-25')
with open('data/comparison.json', 'w') as f:
    json.dump({
        "detected_area_m2": round(detected_area_m2, 2),
        "outside_area_m2": round(outside_area_m2, 2),
        "pct_outside": round(pct_outside, 2),
        "time_start": time_start,
        "time_end": time_end
    }, f)

# Save outputs
if not detected_gdf.empty:
    detected_gdf.to_file('data/detected_polygons.geojson', driver='GeoJSON')
else:
    gpd.GeoSeries([], crs='EPSG:4326').to_file('data/detected_polygons.geojson', driver='GeoJSON')

if not outside.is_empty.all():
    outside.to_file('data/detected_outside.geojson', driver='GeoJSON')
else:
    gpd.GeoSeries([], crs='EPSG:4326').to_file('data/detected_outside.geojson', driver='GeoJSON')

print('Saved data/detected_polygons.geojson and data/detected_outside.geojson')
