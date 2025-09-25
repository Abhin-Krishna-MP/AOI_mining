// MiningWatch Detection Results Map Application

class MiningWatchMap {
    constructor() {
        this.map = null;
        this.resultsLayer = null;
        this.aoiLayer = null;
        this.resultsData = null;
        this.aoiData = null;
        
        this.init();
    }
    
    async init() {
        this.initMap();
        await this.loadData();
        this.processData();
        this.addLayers();
        this.bindControls();
    }
    
    initMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([0, 0], 2);
        
        // Add OpenStreetMap base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
    }
    
    async loadData() {
        try {
            console.log('Loading GeoJSON data...');
            
            // Load results and AOI data
            const [resultsResponse, aoiResponse] = await Promise.all([
                fetch('/results.geojson'),
                fetch('/data/aoi.geojson')
            ]);
            
            if (!resultsResponse.ok) {
                throw new Error(`Failed to load results: ${resultsResponse.status}`);
            }
            
            if (!aoiResponse.ok) {
                throw new Error(`Failed to load AOI: ${aoiResponse.status}`);
            }
            
            this.resultsData = await resultsResponse.json();
            this.aoiData = await aoiResponse.json();
            
            console.log('Data loaded successfully');
            console.log('Results features:', this.resultsData.features.length);
            console.log('AOI features:', this.aoiData.features.length);
            
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading GeoJSON data. Please ensure files are available.');
        }
    }
    
    processData() {
        if (!this.resultsData || !this.aoiData) return;
        
        console.log('Processing spatial relationships...');
        
        // Process each mining detection result
        this.resultsData.features.forEach((feature, index) => {
            try {
                // Determine if polygon is inside or outside AOI
                const isInside = this.isPolygonInsideAOI(feature);
                
                // Add classification to feature properties
                feature.properties = feature.properties || {};
                feature.properties.status = isInside ? 'legal' : 'illegal';
                feature.properties.classification = isInside ? 'Legal Mining' : 'Illegal Mining';
                
                console.log(`Feature ${index}: ${feature.properties.classification}`);
                
            } catch (error) {
                console.error(`Error processing feature ${index}:`, error);
                feature.properties = feature.properties || {};
                feature.properties.status = 'unknown';
                feature.properties.classification = 'Unknown';
            }
        });
    }
    
    isPolygonInsideAOI(polygon) {
        if (!this.aoiData || !this.aoiData.features.length) return false;
        
        try {
            // Use Turf.js for spatial analysis
            const polygonTurf = turf.feature(polygon.geometry);
            
            // Check against each AOI polygon
            for (const aoiFeature of this.aoiData.features) {
                const aoiTurf = turf.feature(aoiFeature.geometry);
                
                // Check if polygon is within AOI
                if (turf.booleanWithin(polygonTurf, aoiTurf)) {
                    return true;
                }
                
                // Also check for significant overlap (>50%)
                try {
                    const intersection = turf.intersect(polygonTurf, aoiTurf);
                    if (intersection) {
                        const polygonArea = turf.area(polygonTurf);
                        const intersectionArea = turf.area(intersection);
                        const overlapPercentage = (intersectionArea / polygonArea) * 100;
                        
                        if (overlapPercentage > 50) {
                            return true;
                        }
                    }
                } catch (intersectionError) {
                    // Continue checking other AOI features
                    console.warn('Intersection calculation failed:', intersectionError);
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('Spatial analysis error:', error);
            return false;
        }
    }
    
    addLayers() {
        if (!this.resultsData || !this.aoiData) return;
        
        // Add mining results layer
        this.resultsLayer = L.geoJSON(this.resultsData, {
            style: (feature) => this.getPolygonStyle(feature),
            onEachFeature: (feature, layer) => this.bindPopup(feature, layer)
        }).addTo(this.map);
        
        // Add AOI layer
        this.aoiLayer = L.geoJSON(this.aoiData, {
            style: {
                fillColor: 'transparent',
                color: '#3b82f6',
                weight: 2,
                opacity: 1,
                dashArray: '8, 8',
                fillOpacity: 0
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`
                    <div class="popup-title">Area of Interest</div>
                    <div>Authorized mining boundary</div>
                `);
            }
        }).addTo(this.map);
        
        // Fit map to show all data
        const group = new L.featureGroup([this.resultsLayer, this.aoiLayer]);
        this.map.fitBounds(group.getBounds().pad(0.1));
    }
    
    getPolygonStyle(feature) {
        const status = feature.properties?.status || 'unknown';
        
        const styles = {
            legal: {
                fillColor: '#22c55e',
                color: '#16a34a',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            },
            illegal: {
                fillColor: '#ef4444',
                color: '#dc2626',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            },
            unknown: {
                fillColor: '#94a3b8',
                color: '#64748b',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.5
            }
        };
        
        return styles[status] || styles.unknown;
    }
    
    bindPopup(feature, layer) {
        const props = feature.properties || {};
        const status = props.status || 'unknown';
        const classification = props.classification || 'Unknown';
        
        // Format popup content
        const popupContent = `
            <div class="popup-title">Mining Detection</div>
            <div class="popup-status ${status}">${classification}</div>
            <div class="popup-data">
                <div><strong>Area:</strong> ${this.formatValue(props.area_m2, 'm²')}</div>
                <div><strong>Mean Depth:</strong> ${this.formatValue(props.mean_depth_m, 'm')}</div>
                <div><strong>Max Depth:</strong> ${this.formatValue(props.max_depth_m, 'm')}</div>
                <div><strong>Volume:</strong> ${this.formatValue(props.volume_m3, 'm³')}</div>
            </div>
        `;
        
        layer.bindPopup(popupContent);
    }
    
    formatValue(value, unit) {
        if (value === null || value === undefined || value === '') {
            return 'N/A';
        }
        
        const num = parseFloat(value);
        if (isNaN(num)) {
            return 'N/A';
        }
        
        // Format large numbers with commas
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }) + ' ' + unit;
    }
    
    bindControls() {
        // Layer toggle controls
        const toggleResults = document.getElementById('toggleResults');
        const toggleAOI = document.getElementById('toggleAOI');
        
        toggleResults.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.map.addLayer(this.resultsLayer);
            } else {
                this.map.removeLayer(this.resultsLayer);
            }
        });
        
        toggleAOI.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.map.addLayer(this.aoiLayer);
            } else {
                this.map.removeLayer(this.aoiLayer);
            }
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing MiningWatch Detection Results Map...');
    new MiningWatchMap();
});