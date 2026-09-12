import { CameraControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import CameraControlsLib from "camera-controls";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLOBE_RADIUS, latLngToVector3, makeLatLngVector } from "@/lib/geo";
import { useGlobeStore } from "@/lib/globe-store";
import { LOCATIONS } from "@/lib/locations";

const SUN = new THREE.Vector3(3.6, 1.35, 2.15);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
const FOCUS_POS = new THREE.Vector3();
const LOOK_AT = new THREE.Vector3();
const VIEW_DIR = new THREE.Vector3();
const VIEW_RIGHT = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const TEXTURE_URLS = {
  day: "/textures/earth-day.jpg",
  night: "/textures/earth-night.jpg",
  clouds: "/textures/earth-clouds.png",
} as const;

type GlobeMaps = {
  day: THREE.Texture;
  night: THREE.Texture;
  clouds: THREE.Texture;
};

const ATM_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const ATM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uPower;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - abs(dot(viewDir, n)), uPower);
  float sun = 0.38 + 0.62 * smoothstep(-0.2, 0.55, dot(n, normalize(uLight)));
  gl_FragColor = vec4(uColor, clamp(fresnel * uIntensity * sun, 0.0, 1.0));
}
`;

const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform vec3 uLight;
uniform float uFade;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 l = normalize(uLight);
  vec3 v = normalize(cameraPosition - vWorldPos);
  float ndl = dot(n, l);
  float dayness = smoothstep(-0.16, 0.38, ndl);
  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  vec3 nightMix = day * 0.2 + night * 1.45;
  vec3 color = mix(nightMix, day, dayness);
  float ocean = 1.0 - smoothstep(0.14, 0.42, dot(day, vec3(0.33)));
  vec3 h = normalize(l + v);
  float spec = pow(max(dot(n, h), 0.0), 52.0) * ocean * dayness;
  color += spec * vec3(0.82, 0.9, 1.0) * 0.55;
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.8);
  color += vec3(0.42, 0.66, 0.95) * fresnel * (0.18 + 0.7 * dayness);
  gl_FragColor = vec4(color * uFade, 1.0);
}
`;

const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uLight;
uniform float uFade;
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  float cover = texture2D(uClouds, vUv).r;
  float dayness = smoothstep(-0.12, 0.32, dot(normalize(vWorldNormal), normalize(uLight)));
  float alpha = cover * mix(0.05, 0.22, dayness) * uFade;
  gl_FragColor = vec4(vec3(0.9, 0.94, 0.97), alpha);
}
`;

async function loadTexture(url: string, colorSpace: THREE.ColorSpace, anisotropy: number, brighten = 1) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  if (brighten !== 1) ctx.filter = `brightness(${brighten}) saturate(1.18)`;
  ctx.drawImage(bitmap, 0, 0);
  ctx.filter = "none";
  bitmap.close();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function useGlobeMaps() {
  const { gl } = useThree();
  const [maps, setMaps] = useState<GlobeMaps | null>(null);

  useEffect(() => {
    let cancelled = false;
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const loaded: THREE.Texture[] = [];

    Promise.all([
      loadTexture(TEXTURE_URLS.day, THREE.NoColorSpace, anisotropy, 2.45),
      loadTexture(TEXTURE_URLS.night, THREE.NoColorSpace, anisotropy, 3.2),
      loadTexture(TEXTURE_URLS.clouds, THREE.NoColorSpace, anisotropy),
    ])
      .then(([day, night, clouds]) => {
        loaded.push(day, night, clouds);
        if (!cancelled) setMaps({ day, night, clouds });
      })
      .catch((error) => {
        console.error("[meridian] earth textures failed", error);
      });

    return () => {
      cancelled = true;
      for (const texture of loaded) texture.dispose();
    };
  }, [gl]);

  return maps;
}

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(232, 242, 255, 1)");
  gradient.addColorStop(0.22, "rgba(176, 208, 232, 0.55)");
  gradient.addColorStop(0.5, "rgba(130, 172, 210, 0.16)");
  gradient.addColorStop(1, "rgba(90, 140, 180, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Atmosphere() {
  const outer = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#7ea8d6") },
      uLight: { value: SUN.clone().normalize() },
      uPower: { value: 2.45 },
      uIntensity: { value: 0.92 },
    }),
    [],
  );
  const inner = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#c3daf0") },
      uLight: { value: SUN.clone().normalize() },
      uPower: { value: 4.2 },
      uIntensity: { value: 0.28 },
    }),
    [],
  );

  return (
    <group>
      <mesh scale={1.09} renderOrder={-1}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <shaderMaterial
          vertexShader={ATM_VERT}
          fragmentShader={ATM_FRAG}
          uniforms={outer}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh scale={1.02} renderOrder={1}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <shaderMaterial
          vertexShader={ATM_VERT}
          fragmentShader={ATM_FRAG}
          uniforms={inner}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}

function Earth() {
  const maps = useGlobeMaps();
  const cloudRef = useRef<THREE.Mesh>(null);
  const fade = useRef(0);

  const earthUniforms = useMemo(() => {
    if (!maps) return null;
    return {
      uDay: { value: maps.day },
      uNight: { value: maps.night },
      uLight: { value: SUN.clone().normalize() },
      uFade: { value: 0 },
    };
  }, [maps]);

  const cloudUniforms = useMemo(() => {
    if (!maps) return null;
    return {
      uClouds: { value: maps.clouds },
      uLight: { value: SUN.clone().normalize() },
      uFade: { value: 0 },
    };
  }, [maps]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (maps && fade.current < 1) {
      fade.current = Math.min(1, fade.current + dt / 0.65);
      if (earthUniforms) earthUniforms.uFade.value = fade.current;
      if (cloudUniforms) cloudUniforms.uFade.value = fade.current;
    }
    if (cloudRef.current) cloudRef.current.rotation.y += 0.008 * dt;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 96, 64]} />
        {earthUniforms ? (
          <shaderMaterial vertexShader={EARTH_VERT} fragmentShader={EARTH_FRAG} uniforms={earthUniforms} />
        ) : (
          <meshBasicMaterial color="#152433" />
        )}
      </mesh>
      {cloudUniforms ? (
        <mesh ref={cloudRef} scale={1.008}>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 48]} />
          <shaderMaterial
            vertexShader={CLOUD_VERT}
            fragmentShader={CLOUD_FRAG}
            uniforms={cloudUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function Marker({
  id,
  lat,
  lng,
  glow,
}: {
  id: string;
  lat: number;
  lng: number;
  glow: THREE.Texture;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const selectedId = useGlobeStore((s) => s.selectedId);
  const hoveredId = useGlobeStore((s) => s.hoveredId);
  const select = useGlobeStore((s) => s.select);
  const setHovered = useGlobeStore((s) => s.setHovered);
  const selected = selectedId === id;
  const hovered = hoveredId === id;
  const position = useMemo(() => makeLatLngVector(lat, lng, GLOBE_RADIUS + 0.028), [lat, lng]);

  useLayoutEffect(() => {
    const node = group.current;
    if (!node) return;
    node.position.copy(position);
    LOOK_AT.copy(position).multiplyScalar(2);
    node.lookAt(LOOK_AT);
  }, [position]);

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    const facing = position.dot(camera.position) / (position.length() * camera.position.length());
    const vis = THREE.MathUtils.smoothstep(-0.05, 0.22, facing);
    const node = group.current;
    if (node) {
      node.visible = vis > 0.05;
      node.userData.visibility = vis;
    }
    const pulse = 1 + Math.sin(t * (selected ? 3.2 : 2.1) + lat) * (selected ? 0.16 : 0.08);
    const scale = (selected ? 1.5 : hovered ? 1.24 : 1) * pulse * (0.65 + vis * 0.35);
    if (halo.current) {
      const s = (selected ? 0.42 : 0.32) * scale;
      halo.current.scale.set(s, s, s);
    }
    if (ring.current) {
      ring.current.rotation.z += dt * (selected ? 0.7 : 0.25);
      const r = 0.85 + (selected ? 0.22 : 0) + Math.sin(t * 2.4) * 0.06;
      ring.current.scale.setScalar(r);
    }
  });

  return (
    <group ref={group}>
      <sprite ref={halo} renderOrder={3}>
        <spriteMaterial
          map={glow}
          transparent
          depthTest
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color={selected ? "#f2f7fc" : hovered ? "#e4eef8" : "#cfe0f0"}
          opacity={selected ? 1 : 0.88}
        />
      </sprite>
      <mesh>
        <sphereGeometry args={[selected ? 0.034 : 0.022, 16, 16]} />
        <meshBasicMaterial color={selected ? "#f7fbff" : "#d7e6f5"} depthTest />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.0026, 8, 32]} />
        <meshBasicMaterial
          color={selected ? "#e8f1f8" : "#9eb8d0"}
          transparent
          opacity={selected ? 0.95 : 0.55}
          depthTest
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, selected ? 0.1 : 0.045]}>
        <cylinderGeometry args={[0.0036, 0.0036, selected ? 0.18 : 0.08, 8]} />
        <meshBasicMaterial color="#e8f1f8" transparent opacity={selected ? 0.88 : 0.4} depthTest />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          select(id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(id);
        }}
        onPointerOut={() => setHovered(null)}
      >
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Markers({ glow }: { glow: THREE.Texture }) {
  return (
    <group>
      {LOCATIONS.map((place) => (
        <Marker key={place.id} id={place.id} lat={place.lat} lng={place.lng} glow={glow} />
      ))}
    </group>
  );
}

function CameraRig() {
  const ref = useRef<CameraControlsLib>(null);
  const transitioning = useRef(false);
  const selectedId = useGlobeStore((s) => s.selectedId);
  const autoRotate = useGlobeStore((s) => s.autoRotate);
  const interacting = useGlobeStore((s) => s.interacting);
  const reducedMotion = useGlobeStore((s) => s.reducedMotion);
  const setInteracting = useGlobeStore((s) => s.setInteracting);

  useLayoutEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.mouseButtons.right = CameraControlsLib.ACTION.NONE;
    controls.mouseButtons.middle = CameraControlsLib.ACTION.DOLLY;
    controls.mouseButtons.wheel = CameraControlsLib.ACTION.DOLLY;
    controls.touches.two = CameraControlsLib.ACTION.TOUCH_DOLLY;
  }, []);

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    if (!selectedId) {
      void controls.setLookAt(1.05, 0.4, 3.35, 0, 0, 0, !reducedMotion);
      return;
    }
    const place = LOCATIONS.find((item) => item.id === selectedId);
    if (!place) return;
    const distance = THREE.MathUtils.clamp(controls.distance, 2.7, 3.55);
    const viewLat = THREE.MathUtils.clamp(place.lat * 0.58, -54, 54);
    latLngToVector3(viewLat, place.lng, 1, VIEW_DIR);
    FOCUS_POS.copy(VIEW_DIR).multiplyScalar(distance);
    VIEW_RIGHT.crossVectors(VIEW_DIR, WORLD_UP);
    if (VIEW_RIGHT.lengthSq() < 0.0001) VIEW_RIGHT.set(1, 0, 0);
    else VIEW_RIGHT.normalize();
    FOCUS_POS.addScaledVector(VIEW_RIGHT, 0.12);
    CAMERA_TARGET.copy(VIEW_DIR).multiplyScalar(0.18);
    void controls.setLookAt(
      FOCUS_POS.x,
      FOCUS_POS.y,
      FOCUS_POS.z,
      CAMERA_TARGET.x,
      CAMERA_TARGET.y,
      CAMERA_TARGET.z,
      !reducedMotion,
    );
  }, [reducedMotion, selectedId]);

  useFrame((_, delta) => {
    const controls = ref.current;
    if (!controls) return;
    const dt = Math.min(delta, 0.1);
    if (autoRotate && !interacting && !selectedId && !transitioning.current && !reducedMotion) {
      controls.azimuthAngle += 0.1 * dt;
    }
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={2.35}
      maxDistance={5.2}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI - 0.2}
      smoothTime={0.78}
      draggingSmoothTime={0.12}
      azimuthRotateSpeed={0.58}
      polarRotateSpeed={0.52}
      dollySpeed={0.32}
      onStart={() => setInteracting(true)}
      onEnd={() => setInteracting(false)}
      onTransitionStart={() => {
        transitioning.current = true;
      }}
      onRest={() => {
        transitioning.current = false;
      }}
    />
  );
}

function CursorBinder() {
  const hoveredId = useGlobeStore((s) => s.hoveredId);
  const interacting = useGlobeStore((s) => s.interacting);
  const { gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    el.style.cursor = hoveredId ? "pointer" : interacting ? "grabbing" : "grab";
  }, [gl, hoveredId, interacting]);

  return null;
}

function SceneContent({ glow }: { glow: THREE.Texture }) {
  return (
    <>
      <color attach="background" args={["#06080c"]} />
      <Stars radius={90} depth={48} count={1800} factor={2.4} saturation={0} fade speed={0.28} />
      <Earth />
      <Atmosphere />
      <Markers glow={glow} />
      <CameraRig />
      <CursorBinder />
    </>
  );
}

export function GlobeScene() {
  const [glow, setGlow] = useState<THREE.Texture | null>(null);
  const hoveredId = useGlobeStore((s) => s.hoveredId);

  useEffect(() => {
    const texture = createGlowTexture();
    setGlow(texture);
    return () => {
      texture.dispose();
    };
  }, []);

  return (
    <div
      className="absolute inset-0 touch-none max-md:bottom-40 md:right-[26rem]"
      role="application"
      aria-label="Interactive Earth globe. Drag to spin. Click a glowing marker to focus."
    >
      <Canvas
        camera={{ position: [1.05, 0.4, 3.35], fov: 40, near: 0.1, far: 200 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
        }}
        onPointerMissed={() => {
          useGlobeStore.getState().setHovered(null);
        }}
        style={{ cursor: hoveredId ? "pointer" : "grab" }}
      >
        {glow ? <SceneContent glow={glow} /> : <color attach="background" args={["#06080c"]} />}
      </Canvas>
    </div>
  );
}
