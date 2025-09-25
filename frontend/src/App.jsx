




import './App.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet/dist/leaflet.css';



function App() {
  // Only keep state for drawn AOI and map bounds
  const [drawnAoi, setDrawnAoi] = useState(null);
  const [detected, setDetected] = useState(null);
  const [outside, setOutside] = useState(null);
  const featureGroupRef = useRef(null);

  // On mount, load AOI from backend if exists
  useEffect(() => {
    fetch('/data/user_aoi.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setDrawnAoi(data);
      });
    fetch('/data/detected_polygons.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setDetected(data);
      });
    fetch('/data/detected_outside.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setOutside(data);
      });
  }, []);

  // Default center (India)
  let center = [20, 77];
  let bounds = null;
  const aoiToShow = drawnAoi;
  if (aoiToShow && aoiToShow.features && aoiToShow.features.length > 0) {
    const coords = aoiToShow.features[0].geometry.coordinates[0];
    bounds = coords.map(([lng, lat]) => [lat, lng]);
    center = bounds[0];
  }

  function FitBounds({ bounds }) {
    const map = useMap();
    useEffect(() => {
      if (bounds && bounds.length > 1) {
        map.fitBounds(bounds);
      }
    }, [bounds, map]);
    return null;
  }

  // Handle AOI draw
  const onCreated = (e) => {
    const layer = e.layer;
    const geojson = layer.toGeoJSON();
    const featureCollection = { type: 'FeatureCollection', features: [geojson] };
    setDrawnAoi(featureCollection);
    fetch('/data/user_aoi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(featureCollection)
    })
      .then(res => res.json())
      .then(data => {
        setTimeout(() => {
          fetch('/data/comparison.json')
            .then(r => r.ok ? r.json() : null)
            .then(comparison => {
              if (comparison) {
                alert(
                  `Detection Results:\n` +
                  `Detected area: ${comparison.detected_area_m2} m²\n` +
                  `Outside AOI: ${comparison.outside_area_m2} m²\n` +
                  `Percent outside: ${comparison.pct_outside} %`
                );
              } else {
                alert('Detection complete, but no results found.');
              }
            });
        }, 1000);
      });
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#f5f7fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* AOI upload option - now above the card */}
      <form style={{
        marginBottom: 24,
        background: '#f5f7fa',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid #e0e7ef',
        zIndex: 10,
      }}>
        <label style={{ fontSize: 15, fontWeight: 500, marginRight: 8 }}>Upload AOI:</label>
        <input
          type="file"
          accept="application/geo+json,application/json,.geojson,.json"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              const text = await file.text();
              const geojson = JSON.parse(text);
              // Only accept FeatureCollection or Feature
              let featureCollection = geojson;
              if (geojson.type === 'Feature') {
                featureCollection = { type: 'FeatureCollection', features: [geojson] };
              }
              if (geojson.type === 'FeatureCollection') {
                setDrawnAoi(featureCollection);
                // Send to backend
                fetch('/data/user_aoi', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(featureCollection)
                })
                  .then(res => res.json())
                  .then(data => {
                    setTimeout(() => {
                      fetch('/data/comparison.json')
                        .then(r => r.ok ? r.json() : null)
                        .then(comparison => {
                          if (comparison) {
                            alert(
                              `Detection Results:\n` +
                              `Detected area: ${comparison.detected_area_m2} m²\n` +
                              `Outside AOI: ${comparison.outside_area_m2} m²\n` +
                              `Percent outside: ${comparison.pct_outside} %`
                            );
                          } else {
                            alert('Detection complete, but no results found.');
                          }
                        });
                    }, 1000);
                  });
              } else {
                alert('Invalid GeoJSON: must be a Feature or FeatureCollection.');
              }
            } catch (err) {
              alert('Invalid file or JSON.');
            }
          }}
          style={{ fontSize: 15 }}
        />
      </form>
      <div style={{
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        padding: 0,
        width: 700,
        maxWidth: '95vw',
        minHeight: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '40px 0',
        position: 'relative'
      }}>
        <div style={{ width: '100%', height: 480, borderRadius: 14, overflow: 'hidden', margin: '24px 0' }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {bounds && <FitBounds bounds={bounds} />}
            <FeatureGroup ref={featureGroupRef}>
              <EditControl
                position="topright"
                onCreated={onCreated}
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                  polygon: { allowIntersection: false, showArea: false }
                }}
                edit={{ remove: true }}
                featureGroup={featureGroupRef.current}
              />
              {aoiToShow && <GeoJSON data={aoiToShow} style={{ color: '#088', weight: 2, fillOpacity: 0.2 }} />}
            </FeatureGroup>
            {detected && <GeoJSON data={detected} style={{ color: '#f00', weight: 2, fillOpacity: 0.35 }} />}
            {outside && <GeoJSON data={outside} style={() => ({ color: '#ff9800', weight: 2, fillOpacity: 0.5 })} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
