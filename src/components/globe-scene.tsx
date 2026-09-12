import { CameraControls, Stars, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import CameraControlsLib from "camera-controls";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLOBE_RADIUS, latLngToVector3, makeLatLngVector } from "@/lib/geo";
import { useGlobeStore } from "@/lib/globe-store";
import { LOCATIONS } from "@/lib/locations";

const SUN = new THREE.Vector3(4.6, 2.1, 3.2);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
const FOCUS_POS = new THREE.Vector3();
const LOOK_AT = new THREE.Vector3();

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
uniform float uPower;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), uPower);
  gl_FragColor = vec4(uColor, clamp(fresnel * uIntensity, 0.0, 1.0));
}
`;

const NIGHT_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NIGHT_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uLight;
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  float night = smoothstep(0.2, -0.12, dot(normalize(vWorldNormal), normalize(uLight)));
  vec3 color = texture2D(uMap, vUv).rgb;
  float lum = max(max(color.r, color.g), color.b);
  gl_FragColor = vec4(color * 1.55, night * pow(lum, 1.15) * 0.95);
}
`;

function configureMap(texture: THREE.Texture, colorSpace: THREE.ColorSpace, anisotropy: number) {
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
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
      uPower: { value: 2.6 },
      uIntensity: { value: 0.78 },
    }),
    [],
  );
  const inner = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#b7d0e8") },
      uPower: { value: 4.4 },
      uIntensity: { value: 0.22 },
    }),
    [],
  );

  return (
    <group>
      <mesh scale={1.08} renderOrder={-1}>
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
      <mesh scale={1.018} renderOrder={1}>
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
  const { gl } = useThree();
  const cloudRef = useRef<THREE.Mesh>(null);
  const [dayMap, nightMap, bumpMap, waterMap, cloudMap] = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-night.jpg",
    "/textures/earth-bump.png",
    "/textures/earth-water.png",
    "/textures/earth-clouds.png",
  ]);

  useLayoutEffect(() => {
    const anisotropy = gl.capabilities.getMaxAnisotropy();
    configureMap(dayMap, THREE.SRGBColorSpace, anisotropy);
    configureMap(nightMap, THREE.SRGBColorSpace, anisotropy);
    configureMap(cloudMap, THREE.NoColorSpace, anisotropy);
    configureMap(bumpMap, THREE.NoColorSpace, anisotropy);
    configureMap(waterMap, THREE.NoColorSpace, anisotropy);
  }, [bumpMap, cloudMap, dayMap, gl, nightMap, waterMap]);

  const nightUniforms = useMemo(
    () => ({
      uMap: { value: nightMap },
      uLight: { value: SUN.clone().normalize() },
    }),
    [nightMap],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (cloudRef.current) cloudRef.current.rotation.y += 0.01 * dt;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={dayMap}
          color="#c9d4e2"
          bumpMap={bumpMap}
          bumpScale={0.035}
          metalnessMap={waterMap}
          metalness={0.42}
          roughness={0.78}
          envMapIntensity={0.35}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.002, 64, 64]} />
        <shaderMaterial
          vertexShader={NIGHT_VERT}
          fragmentShader={NIGHT_FRAG}
          uniforms={nightUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={cloudRef} scale={1.01}>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <meshLambertMaterial
          map={cloudMap}
          alphaMap={cloudMap}
          transparent
          opacity={0.22}
          depthWrite={false}
          color="#c9d6e4"
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.004, 36, 18]} />
        <meshBasicMaterial color="#8aa0b8" wireframe transparent opacity={0.045} />
      </mesh>
    </group>
  );
}

function PlaceholderGlobe() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
      <meshStandardMaterial color="#1a2430" roughness={1} metalness={0} />
    </mesh>
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

  const position = useMemo(() => makeLatLngVector(lat, lng, GLOBE_RADIUS + 0.02), [lat, lng]);

  useLayoutEffect(() => {
    const node = group.current;
    if (!node) return;
    node.position.copy(position);
    LOOK_AT.copy(position).multiplyScalar(2);
    node.lookAt(LOOK_AT);
  }, [position]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * (selected ? 3.2 : 2.1) + lat) * (selected ? 0.16 : 0.08);
    const scale = (selected ? 1.35 : hovered ? 1.18 : 1) * pulse;
    if (halo.current) {
      const s = 0.22 * scale;
      halo.current.scale.set(s, s, s);
    }
    if (ring.current) {
      ring.current.rotation.z += dt * (selected ? 0.7 : 0.25);
      const r = 0.85 + (selected ? 0.2 : 0) + Math.sin(t * 2.4) * 0.06;
      ring.current.scale.setScalar(r);
    }
  });

  return (
    <group ref={group}>
      <sprite ref={halo} renderOrder={3}>
        <spriteMaterial
          map={glow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color={selected ? "#f2f7fc" : "#cfe0f0"}
          opacity={selected ? 1 : 0.85}
        />
      </sprite>
      <mesh>
        <sphereGeometry args={[selected ? 0.022 : 0.016, 16, 16]} />
        <meshBasicMaterial color={selected ? "#f7fbff" : "#d7e6f5"} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.038, 0.0022, 8, 32]} />
        <meshBasicMaterial
          color={selected ? "#e8f1f8" : "#9eb8d0"}
          transparent
          opacity={selected ? 0.95 : 0.55}
        />
      </mesh>
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.07]}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.12, 8]} />
          <meshBasicMaterial color="#e8f1f8" transparent opacity={0.7} />
        </mesh>
      ) : null}
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
        <sphereGeometry args={[0.07, 8, 8]} />
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
    if (!controls || !selectedId) return;
    const place = LOCATIONS.find((item) => item.id === selectedId);
    if (!place) return;
    const distance = THREE.MathUtils.clamp(controls.distance, 2.75, 3.9);
    const viewLat = THREE.MathUtils.clamp(place.lat * 0.62, -58, 58);
    latLngToVector3(viewLat, place.lng, distance, FOCUS_POS);
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
    if (
      autoRotate &&
      !interacting &&
      !selectedId &&
      !transitioning.current &&
      !reducedMotion
    ) {
      controls.azimuthAngle += 0.11 * dt;
    }
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={2.4}
      maxDistance={5.5}
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI - 0.18}
      smoothTime={0.72}
      draggingSmoothTime={0.14}
      azimuthRotateSpeed={0.58}
      polarRotateSpeed={0.52}
      dollySpeed={0.35}
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
      <ambientLight intensity={0.16} color="#9bb0c8" />
      <hemisphereLight args={["#c3d2e4", "#0c141c", 0.52]} />
      <directionalLight position={[SUN.x, SUN.y, SUN.z]} intensity={1.15} color="#fff1de" />
      <directionalLight position={[-4.2, -1.1, -2.4]} intensity={0.32} color="#6d829c" />
      <Stars radius={90} depth={42} count={2600} factor={2.6} saturation={0} fade speed={0.35} />
      <Suspense fallback={<PlaceholderGlobe />}>
        <Earth />
      </Suspense>
      <Atmosphere />
      <Markers glow={glow} />
      <CameraRig />
      <CursorBinder />
    </>
  );
}

export function GlobeScene() {
  const glow = useMemo(() => createGlowTexture(), []);
  const hoveredId = useGlobeStore((s) => s.hoveredId);

  useEffect(() => {
    return () => {
      glow.dispose();
    };
  }, [glow]);

  return (
    <div
      className="absolute inset-0 touch-none"
      role="application"
      aria-label="Interactive Earth globe. Drag to spin. Click a glowing marker to focus."
    >
      <Canvas
        camera={{ position: [0, 0.38, 3.55], fov: 42, near: 0.1, far: 200 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        onPointerMissed={() => {
          useGlobeStore.getState().setHovered(null);
        }}
        style={{ cursor: hoveredId ? "pointer" : "grab" }}
      >
        <SceneContent glow={glow} />
      </Canvas>
    </div>
  );
}
