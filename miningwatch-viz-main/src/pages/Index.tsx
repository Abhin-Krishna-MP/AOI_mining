import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Satellite, 
  Upload, 
  Eye, 
  FileText, 
  BarChart3, 
  Calendar, 
  Target, 
  Shield,
  Box,
  Download,
  Share,
  Zap,
  MapPin,
  TrendingUp
} from "lucide-react";
import DetectionMap, { DetectionStats } from "@/components/DetectionMap";
import React, { useRef, useState } from "react";

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const handleDetectMining = () => {
    setMapKey((k) => k + 1);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with Title and Main Action */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <Badge variant="secondary" className="mb-2 bg-primary/20 text-primary border-primary/30">
                <Satellite className="w-4 h-4 mr-2" />
                Advanced Mining Detection System
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold font-poppins text-foreground">
                Mining Detection Platform
              </h1>
              <p className="text-muted-foreground font-inter mt-1">
                Real-time analysis and monitoring interface
              </p>
            </div>
            <Button 
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload AOI & Detect Mining
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="visualization" className="flex items-center gap-2">
              <Box className="w-4 h-4" />
              3D Visualization
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="how-it-works" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              How It Works
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold font-poppins mb-4">Mining Detection Dashboard</h2>
              <p className="text-xl font-inter text-muted-foreground">Real-time analysis and monitoring interface</p>
            </div>
            
            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Panel - Controls */}
              <div className="lg:col-span-3">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="font-poppins">Detection Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-inter font-semibold">Upload AOI</label>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Select Area of Interest
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/geo+json,application/json,.geojson,.json"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          // Forward to DetectionMap's upload logic
                          const input = document.getElementById("aoi-upload-input") as HTMLInputElement;
                          if (input) input.click();
                          // Reset the file input so the same file can be uploaded again if needed
                          e.target.value = "";
                        }}
                      />
                      <label className="text-sm font-inter font-semibold">Upload DEM</label>
                      <Button variant="outline" className="w-full justify-start">
                        <Upload className="w-4 h-4 mr-2" />
                        Select Digital Elevation Model
                      </Button>
                    </div>
                    
                    {/* Satellite Dates fields removed as requested */}
                    
                    <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleDetectMining}>
                      <Target className="w-4 h-4 mr-2" />
                      Detect Mining Activity
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              {/* Main Map Area */}
              <div className="lg:col-span-6">
                <Card className="h-[500px]">
                  <CardHeader>
                    <CardTitle className="font-poppins flex items-center">
                      <MapPin className="w-5 h-5 mr-2" />
                      Interactive Detection Map
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-full relative p-0">
                    <DetectionMap key={mapKey} onStatsUpdate={setStats} />
                  </CardContent>
                </Card>
              </div>
              
              {/* Right Panel - Stats */}
              <div className="lg:col-span-3">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="font-poppins flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Detection Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-inter">Detected Area</span>
                        <span className="font-semibold text-legal">{stats ? `${(stats.detected_area_m2 / 1e6).toFixed(2)} km²` : "-"}</span>
                      </div>
                      <Progress value={stats ? Math.min(100, (stats.detected_area_m2 / ((stats.detected_area_m2 + stats.outside_area_m2) || 1)) * 100) : 0} className="h-2 bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-inter">Outside AOI</span>
                        <span className="font-semibold text-illegal">{stats ? `${(stats.outside_area_m2 / 1e6).toFixed(2)} km²` : "-"}</span>
                      </div>
                      <Progress value={stats ? Math.min(100, (stats.outside_area_m2 / ((stats.detected_area_m2 + stats.outside_area_m2) || 1)) * 100) : 0} className="h-2 bg-muted" />
                    </div>
                    <div className="pt-4 border-t">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-inter">Percent Outside</span>
                          <span className="font-semibold text-accent">{stats ? `${stats.pct_outside} %` : "-"}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 3D Visualization Tab */}
          <TabsContent value="visualization" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold font-poppins mb-4">3D Terrain Visualization</h2>
              <p className="text-xl font-inter text-muted-foreground">Interactive 3D analysis of mining activity</p>
            </div>
            
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-poppins flex items-center">
                    <Box className="w-5 h-5 mr-2" />
                    3D Mining Analysis
                  </CardTitle>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Toggle 2D/3D
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Box className="w-20 h-20 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-inter text-muted-foreground">3D Terrain Renderer</p>
                    <p className="text-sm text-muted-foreground mt-2">Interactive rotation, zoom, and pan controls</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold font-poppins mb-4">Automated Report Generation</h2>
              <p className="text-xl font-inter text-muted-foreground">Professional documentation with one click</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card>
                <CardHeader>
                  <FileText className="w-12 h-12 text-accent mb-4 mx-auto" />
                  <CardTitle className="font-poppins">PDF Report Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-left space-y-2 text-muted-foreground font-inter">
                    <li>• Map snapshots and overlays</li>
                    <li>• Detected mining areas & statistics</li>
                    <li>• Depth and volume measurements</li>
                    <li>• Legal compliance analysis</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <TrendingUp className="w-12 h-12 text-accent mb-4 mx-auto" />
                  <CardTitle className="font-poppins">Analytics Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-left space-y-2 text-muted-foreground font-inter">
                    <li>• Time-series analysis</li>
                    <li>• Environmental impact metrics</li>
                    <li>• Compliance trend monitoring</li>
                    <li>• Automated alert system</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90">
                <Download className="w-5 h-5 mr-2" />
                Download PDF Report
              </Button>
              <Button size="lg" variant="outline">
                <Share className="w-5 h-5 mr-2" />
                Share Analysis Link
              </Button>
            </div>
          </TabsContent>

          {/* How It Works Tab */}
          <TabsContent value="how-it-works" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold font-poppins mb-4">How It Works</h2>
              <p className="text-xl font-inter text-muted-foreground">Simple three-step process for professional mining detection</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="text-center border-2 hover:border-accent transition-colors">
                <CardHeader>
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Satellite className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="font-poppins">1. Satellite Processing</CardTitle>
                  <CardDescription className="font-inter">
                    Advanced NDVI & Radar analysis of satellite imagery
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground font-inter">
                    Our AI processes multi-spectral satellite data to identify surface changes and excavation patterns with high precision.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center border-2 hover:border-accent transition-colors">
                <CardHeader>
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="font-poppins">2. Legal Compliance</CardTitle>
                  <CardDescription className="font-inter">
                    AOI overlay & illegal mining detection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground font-inter">
                    Automated comparison against authorized mining zones to classify activities as legal or illegal with detailed reporting.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center border-2 hover:border-accent transition-colors">
                <CardHeader>
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="font-poppins">3. Visualization & Reports</CardTitle>
                  <CardDescription className="font-inter">
                    2D/3D visualization + automated reporting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground font-inter">
                    Interactive maps, 3D terrain models, and comprehensive PDF reports generated automatically for stakeholders.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Demo CTA */}
            <div className="mt-16 text-center bg-primary/5 rounded-lg p-8">
              <h2 className="text-3xl md:text-4xl font-bold font-poppins mb-4">Ready to Get Started?</h2>
              <p className="text-xl font-inter text-muted-foreground mb-8">
                Experience the power of automated mining detection
              </p>
              <Button 
                size="lg"
                onClick={() => window.open('/frontend/index.html', '_blank')}
                className="bg-accent hover:bg-accent/90 text-lg px-8 py-3"
              >
                <Eye className="w-5 h-5 mr-2" />
                View Live Demo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;