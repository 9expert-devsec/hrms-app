"use client";

import React, { useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Bounds } from "@react-three/drei";


function Astronaut({ url, scale = 0.38 }) {
  const group = useRef();
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((o) => (o.frustumCulled = false)); // กันโดน culled
  }, [scene]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    // ลอยนิดๆ แบบปลอดภัย ไม่สูงเกินเฟรม
    group.current.position.y = Math.sin(t * 1.2) * 0.02;
    // หมุนมองตามเมาส์เบาๆ
    const px = state.pointer.x,
      py = state.pointer.y;
    group.current.rotation.y += (px * 0.3 - group.current.rotation.y) * 0.08;
    group.current.rotation.x += (-py * 0.18 - group.current.rotation.x) * 0.08;
  });

  return (
    <group ref={group}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}
useGLTF.preload("/models/astronaut.glb");

export default function AstroGLB({
  url = "/models/astronaut.glb",
  scale = 0.34,
  heightClass = "h-44 md:h-56",
}) {
  return (
    <div className={`relative w-full ${heightClass}`}>
      <Canvas
        className="absolute inset-0"
        // ลดภาระ และกัน context lost
        dpr={[1, 1.5]} // ช่วง 1–1.5 (หรือ 1–2 ถ้าเครื่องไหว)
        frameloop="always"
        gl={{
          alpha: true,
          antialias: true, // เปิดกลับมาได้ (กิน GPU นิดหน่อย)
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [0, 0.6, 4.2], fov: 42, near: 0.01, far: 50 }}
        onCreated={({ gl, invalidate }) => {
          gl.setClearColor(0x000000, 0); // โปร่งใสจริง
          const canvas = gl.getContext().canvas;
          // กัน browser reload context แล้วค้าง
          const lost = (e) => {
            e.preventDefault();
            console.warn("WebGL lost");
          };
          const restored = () => {
            console.warn("WebGL restored");
            invalidate();
          };
          canvas.addEventListener("webglcontextlost", lost, false);
          canvas.addEventListener("webglcontextrestored", restored, false);
        }}
      >
        {/* ใช้ไฟธรรมดาแทน Environment เพื่อลดโหลด */}
        <ambientLight intensity={1.0} />
        <directionalLight position={[3, 5, 6]} intensity={1.5} />
        <hemisphereLight intensity={0.6} groundColor={"#222"} />

        {/* เพิ่ม fill light ด้านหน้า */}
        <pointLight position={[0, 2, 4]} intensity={0.8} color={"#ffffff"} />

        {/* เพิ่ม rim/back light ด้านหลัง ให้ขอบดูเด่นขึ้น */}
        <directionalLight
          position={[-3, 2, -4]}
          intensity={0.9}
          color={"#88ccff"}
        />

        {/* เพิ่มไฟจากด้านบนลงมา */}
        <spotLight
          position={[0, 5, 0]}
          angle={0.4}
          penumbra={0.5}
          intensity={1.2}
          castShadow
        />

        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.1}>
            <Astronaut url={url} scale={scale} />
          </Bounds>
        </Suspense>

        {/* ลดโหลดอัตโนมัติเมื่อ FPS ตก */}
        {/* @react-three/drei มี AdaptiveDpr / AdaptiveEvents */}
      </Canvas>
    </div>
  );
}
