# MiningWatch Detection Results Viewer

A self-contained static website for demonstrating MiningWatch detection results with spatial analysis and compliance monitoring.

## Features

- **Interactive Map**: Leaflet-based map with OpenStreetMap basemap
- **Spatial Analysis**: Client-side computation of polygon relationships to Area of Interest (AOI)
- **Legal Compliance**: Automatic classification of mining activities as legal (inside AOI) or illegal (outside AOI)
- **Layer Controls**: Toggle visibility of detection results and AOI boundaries
- **Detailed Popups**: Shows mining attributes including area, depth, and volume data
- **Responsive Design**: Works on desktop and mobile devices

## File Structure

```
frontend/
├── index.html          # Main HTML file with Leaflet integration
├── app.js             # JavaScript for map functionality and spatial analysis
└── styles.css         # Clean, responsive CSS styles

data/
└── aoi.geojson        # Area of Interest boundaries (authorized mining zones)

results.geojson        # Mining detection results with attributes
README.md             # This file
```

## Setup Instructions

1. **Download/Clone Files**: Ensure all files are in the correct structure
2. **Serve Files**: From the `frontend` folder, run:
   ```bash
   python -m http.server 8080
   ```
3. **Open Browser**: Navigate to `http://localhost:8080`

### Alternative Serving Methods

- **Node.js**: `npx http-server -p 8080`
- **PHP**: `php -S localhost:8080`
- **Python 2**: `python -m SimpleHTTPServer 8080`

## Demo Script

### Basic Usage:
1. **Open Application**: Load `http://localhost:8080` in your browser
2. **View Map**: The map loads with mining detection results and AOI boundaries
3. **Click Polygons**: Click any colored polygon to see detection details
4. **Toggle Layers**: Use checkboxes to show/hide different data layers
5. **Check Legend**: Green = legal mining (inside AOI), Red = illegal mining (outside AOI)

### Detailed Testing:
1. **Legal Mining**: Click green polygons to see compliant mining activities
2. **Illegal Mining**: Click red polygons to see non-compliant activities
3. **AOI Boundaries**: Click dashed blue lines to see authorized zone details
4. **Data Attributes**: Popups show area (m²), depth (m), and volume (m³) when available
5. **Missing Data**: Some polygons show "N/A" for missing attributes

## Data Format

### Results GeoJSON (`results.geojson`)
- **Geometry**: Polygon features representing mining areas
- **Properties**:
  - `area_m2`: Mining area in square meters
  - `mean_depth_m`: Average excavation depth in meters
  - `max_depth_m`: Maximum excavation depth in meters
  - `volume_m3`: Estimated excavated volume in cubic meters
  - `detection_date`: Date of detection (optional)
  - `confidence`: Detection confidence score (optional)

### AOI GeoJSON (`data/aoi.geojson`)
- **Geometry**: Polygon features representing authorized mining zones
- **Properties**:
  - `name`: Zone name/identifier
  - `permit_id`: Official permit identifier
  - `authority`: Issuing regulatory authority
  - `valid_from`: Permit start date
  - `valid_until`: Permit expiration date
  - `max_depth_allowed`: Maximum allowed excavation depth

## Spatial Analysis

The application performs client-side spatial analysis using Turf.js:

1. **Containment Check**: Determines if mining polygons are completely within AOI
2. **Overlap Analysis**: Calculates percentage overlap for partial intersections
3. **Classification**: Assigns "legal" status if >50% overlap with AOI
4. **Color Coding**: Applies green (legal) or red (illegal) styling automatically

## Browser Requirements

- **Modern Browser**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **JavaScript**: Must be enabled for spatial analysis
- **Internet**: Required for loading Leaflet and Turf.js libraries

## Customization

- **Basemap**: Modify tile layer URL in `app.js` for different base imagery
- **Styling**: Adjust colors and opacity in `getPolygonStyle()` method
- **Threshold**: Change overlap percentage threshold in `isPolygonInsideAOI()` method
- **Popup Content**: Customize popup format in `bindPopup()` method

## Troubleshooting

- **No Data Loading**: Check that GeoJSON files are in correct locations
- **CORS Errors**: Ensure files are served via HTTP server, not file:// protocol
- **Map Not Loading**: Verify internet connection for CDN resources
- **Analysis Errors**: Check browser console for JavaScript errors

## Dependencies

- **Leaflet 1.9.4**: Interactive map library
- **Turf.js 6.x**: Client-side spatial analysis
- **Modern Browser**: ES6+ JavaScript support

All dependencies are loaded from CDN - no local installation required.