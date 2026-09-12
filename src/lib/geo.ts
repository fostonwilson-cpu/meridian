import * as THREE from "three";

export const GLOBE_RADIUS = 1.6;

const _spherical = new THREE.Vector3();

export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number = GLOBE_RADIUS,
  target: THREE.Vector3 = _spherical,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return target.set(x, y, z);
}

export function makeLatLngVector(lat: number, lng: number, radius: number = GLOBE_RADIUS): THREE.Vector3 {
  return latLngToVector3(lat, lng, radius, new THREE.Vector3());
}
