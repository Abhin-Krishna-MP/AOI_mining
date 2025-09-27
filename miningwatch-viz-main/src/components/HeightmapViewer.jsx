import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function HeightmapViewer({ heightmapUrl, metaUrl }){
  const mountRef = useRef();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let mounted = true;
    if(metaUrl){
      fetch(metaUrl).then(r=>r.json()).then(j=>{ if(mounted) setMeta(j); }).catch(()=>{});
    }
    return ()=>{ mounted=false; }
  }, [metaUrl]);

  useEffect(() => {
    if(!heightmapUrl) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 10000);
    camera.position.set(0, 200, 400);
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(width, height);
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(100,200,100);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x666666));

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("");
    loader.load(heightmapUrl, (tex) => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const segs = meta && meta.width ? Math.max(meta.width - 1, 1) : 10;
      const planeWidth = meta && meta.width ? meta.width : 100;
      const planeHeight = meta && meta.height ? meta.height : 100;
      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segs, segs);
      // Displace vertices by heightmap
      const img = document.createElement('img');
      img.src = heightmapUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        const data = ctx.getImageData(0,0,img.width,img.height).data;
        for(let i=0;i<geometry.attributes.position.count;i++){
          const x = i % img.width;
          const y = Math.floor(i/img.width);
          const idx = (y*img.width + x)*4;
          const h = data[idx]/255.0; // 0-1
          geometry.attributes.position.setZ(i, h*100); // scale
        }
        geometry.computeVertexNormals();
        renderer.render(scene, camera);
      };
      const mat = new THREE.MeshLambertMaterial({map:tex, side:THREE.DoubleSide});
      const mesh = new THREE.Mesh(geometry, mat);
      scene.add(mesh);
      renderer.render(scene, camera);
    });
    return () => {
      mountRef.current.innerHTML = "";
    };
  }, [heightmapUrl, meta]);

  return <div ref={mountRef} style={{width:'100%',height:'400px',background:'#222',borderRadius:8}} />;
}
