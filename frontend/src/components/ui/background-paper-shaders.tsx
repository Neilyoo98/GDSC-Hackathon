"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  uniform float time;
  uniform float intensity;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;

    vec3 pos = position;
    pos.y += sin(pos.x * 10.0 + time) * 0.1 * intensity;
    pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * intensity;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  uniform float intensity;
  uniform vec3 color1;
  uniform vec3 color2;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vec2 uv = vUv;

    float noise = sin(uv.x * 20.0 + time) * cos(uv.y * 15.0 + time * 0.8);
    noise += sin(uv.x * 35.0 - time * 2.0) * cos(uv.y * 25.0 + time * 1.2) * 0.5;

    vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
    color = mix(color, vec3(0.88, 1.0, 0.82), pow(abs(noise), 2.0) * intensity * 0.35);

    float glow = 1.0 - length(uv - 0.5) * 2.0;
    glow = pow(glow, 2.0);

    gl_FragColor = vec4(color * glow, glow * 0.68);
  }
`;

export function ShaderPlane({
  position,
  color1 = "#39ff14",
  color2 = "#e8e4dc",
  scale = 1,
}: {
  position: [number, number, number];
  color1?: string;
  color2?: string;
  scale?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      intensity: { value: 0.8 },
      color1: { value: new THREE.Color(color1) },
      color2: { value: new THREE.Color(color2) },
    }),
    [color1, color2],
  );

  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.intensity.value = 0.72 + Math.sin(state.clock.elapsedTime * 1.6) * 0.18;
  });

  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <planeGeometry args={[2, 2, 32, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function EnergyRing({
  radius = 1,
  position = [0, 0, 0],
}: {
  radius?: number;
  position?: [number, number, number];
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.z = state.clock.elapsedTime * 0.45;
    const material = mesh.current.material as THREE.MeshBasicMaterial;
    material.opacity = 0.18 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08;
  });

  return (
    <mesh ref={mesh} position={position}>
      <ringGeometry args={[radius * 0.82, radius, 96]} />
      <meshBasicMaterial color="#39ff14" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function PaperShaderBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        className="h-full w-full"
      >
        <group position={[0, 0.12, 0]} rotation={[0, 0, -0.08]}>
          <ShaderPlane position={[-1.75, 0.85, -0.6]} color1="#39ff14" color2="#080808" scale={1.55} />
          <ShaderPlane position={[1.55, -0.35, -0.8]} color1="#e8e4dc" color2="#39ff14" scale={1.2} />
          <ShaderPlane position={[0.15, -1.2, -1]} color1="#1f1f1f" color2="#39ff14" scale={1.05} />
          <EnergyRing radius={1.45} position={[0.9, 0.25, -0.35]} />
          <EnergyRing radius={2.15} position={[-0.9, -0.55, -0.8]} />
        </group>
      </Canvas>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,transparent_0%,transparent_24%,#08080888_58%,#080808_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#08080800_0%,#08080822_42%,#080808_92%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#e8e4dc22_1px,transparent_1px),linear-gradient(90deg,#e8e4dc22_1px,transparent_1px)] [background-size:80px_80px]" />
    </div>
  );
}
