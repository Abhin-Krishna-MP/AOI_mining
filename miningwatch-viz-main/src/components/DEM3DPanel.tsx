import React, { useState } from "react";
import VolumeBox from "./VolumeBox";
import axios from "axios";
import { Button } from "@/components/ui/button";


interface DEM3DPanelProps {
  showStatsOnly?: boolean;
  result?: any;
  setResult?: (r: any) => void;
}

export default function DEM3DPanel({ showStatsOnly = false, result: propResult, setResult }: DEM3DPanelProps) {
  const [file, setFile] = useState<File|null>(null);
  const [loading, setLoading] = useState(false);
  const [internalResult, internalSetResult] = useState<any>(null);
  const result = propResult !== undefined ? propResult : internalResult;

  const upload = async () => {
    if(!file) return alert("Please select a GeoTIFF (.tif) file first.");
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    try{
      const res = await axios.post("/upload-dem/", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (setResult) setResult(res.data);
      else internalSetResult(res.data);
    }catch(err:any){
      alert("Upload failed: " + (err?.response?.data?.detail || err.message));
    }finally{
      setLoading(false);
    }
  }

  if (showStatsOnly) {
    return result ? (
      <div className="space-y-2">
        <div className="text-lg font-bold mb-2">Volume Analysis</div>
        <div><b>Volume:</b> {result.volume_m3?.toFixed(2)} m³</div>
        <div><b>Max diff:</b> {result.max_diff?.toFixed(2)} m</div>
        <div><b>Min diff:</b> {result.min_diff?.toFixed(2)} m</div>
        <div><b>Mean diff:</b> {result.mean_diff?.toFixed(2)} m</div>
      </div>
    ) : <div className="text-muted-foreground">No data yet.</div>;
  }
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="w-full flex flex-col md:flex-row items-center gap-4">
        <input type="file" accept=".tif,.tiff" onChange={e=>setFile(e.target.files?.[0]||null)} className="block" />
        <Button onClick={upload} disabled={loading} className="min-w-[150px]">Upload & Analyze</Button>
      </div>
      {loading && <p className="text-muted-foreground">Processing... this may take a while for large files.</p>}
      {result && (
        <div className="w-full flex flex-col items-center mt-4">
          <VolumeBox volume={result.volume_m3} />
        </div>
      )}
    </div>
  );
}
