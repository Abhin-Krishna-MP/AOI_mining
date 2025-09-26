import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet/dist/leaflet.css";

interface DetectionMapProps {
  onStatsUpdate?: (stats: DetectionStats | null) => void;
}

export interface DetectionStats {
  detected_area_m2: number;
  outside_area_m2: number;
  pct_outside: number;
  time_start?: string;
  time_end?: string;
}

const DetectionMap: React.FC<DetectionMapProps> = ({ onStatsUpdate }) => {
  const [drawnAoi, setDrawnAoi] = useState<any>(null);
  const [detected, setDetected] = useState<any>(null);
  const [outside, setOutside] = useState<any>(null);
  const featureGroupRef = useRef<any>(null);

  // Load AOI and polygons on mount
  useEffect(() => {
    fetch("/data/user_aoi.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDrawnAoi(data);
      });
    fetch("/data/detected_polygons.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDetected(data);
      });
    fetch("/data/detected_outside.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setOutside(data);
      });
    fetch("/data/comparison.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((stats) => {
        if (onStatsUpdate) onStatsUpdate(stats);
      });
  }, [onStatsUpdate]);

  // Default center (India)
  let center: [number, number] = [20, 77];
  let bounds: [number, number][] | null = null;
  const aoiToShow = drawnAoi;
  if (aoiToShow && aoiToShow.features && aoiToShow.features.length > 0) {
    const coords = aoiToShow.features[0].geometry.coordinates[0];
    bounds = coords.map(([lng, lat]: [number, number]) => [lat, lng]);
    center = bounds[0];
  }

  function FitBounds({ bounds }: { bounds: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
      if (bounds && bounds.length > 1) {
        map.fitBounds(bounds);
      }
    }, [bounds, map]);
    return null;
  }

  // Poll for detection results after AOI update
  function pollForResults(maxTries = 20, interval = 500) {
    let tries = 0;
    const poll = () => {
      Promise.all([
        fetch("/data/detected_polygons.geojson").then(r => r.ok ? r.json() : null),
        fetch("/data/detected_outside.geojson").then(r => r.ok ? r.json() : null),
        fetch("/data/comparison.json").then(r => r.ok ? r.json() : null),
        fetch("/data/user_aoi.geojson").then(r => r.ok ? r.json() : null)
      ]).then(([det, out, comp, aoi]) => {
        if (det && det.features && det.features.length > 0) setDetected(det);
        if (out && out.features && out.features.length > 0) setOutside(out);
        if (aoi && aoi.features && aoi.features.length > 0) setDrawnAoi(aoi);
        if (comp && comp.detected_area_m2 !== undefined) {
          if (onStatsUpdate) onStatsUpdate(comp);
          return; // stop polling
        }
        tries++;
        if (tries < maxTries) setTimeout(poll, interval);
      });
    };
    poll();
  }

  // Handle AOI draw
  const onCreated = (e: any) => {
    const layer = e.layer;
    const geojson = layer.toGeoJSON();
    const featureCollection = { type: "FeatureCollection", features: [geojson] };
    setDrawnAoi(featureCollection);
    fetch("/data/user_aoi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(featureCollection),
    })
      .then((res) => res.json())
      .then(() => {
        pollForResults();
      });
  };

  // Handle AOI upload
  const handleAoiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      let featureCollection = geojson;
      if (geojson.type === "Feature") {
        featureCollection = { type: "FeatureCollection", features: [geojson] };
      }
      if (geojson.type === "FeatureCollection") {
        setDrawnAoi(featureCollection);
        fetch("/data/user_aoi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(featureCollection),
        })
          .then((res) => res.json())
          .then(() => {
            pollForResults();
          });
      }
    } catch (err) {
      // Silently ignore invalid file or JSON
    }
  };

  return (
    <div className="h-full w-full">
      <input
        type="file"
        accept="application/geo+json,application/json,.geojson,.json"
        onChange={handleAoiUpload}
        style={{ display: "none" }}
        id="aoi-upload-input"
      />
      {/* @ts-ignore */}
      <MapContainer center={center as [number, number]} zoom={12} style={{ height: "100%", width: "100%" }}>
        {/* @ts-ignore */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?attribution=%26copy%3B%20OpenStreetMap%20contributors"
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
              polygon: { allowIntersection: false, showArea: false },
            }}
          />
          {aoiToShow && (
            <GeoJSON
              data={aoiToShow}
              // @ts-ignore
              style={() => ({ color: "#088", weight: 2, fillOpacity: 0.2 })}
            />
          )}
        </FeatureGroup>
        {detected && (
          <GeoJSON
            data={detected}
            // @ts-ignore
            style={() => ({ color: "#f00", weight: 2, fillOpacity: 0.35 })}
          />
        )}
        {outside && (
          <GeoJSON
            data={outside}
            // @ts-ignore
            style={() => ({ color: "#ff9800", weight: 2, fillOpacity: 0.5 })}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default DetectionMap;
