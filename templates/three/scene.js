import * as THREE from 'three';
import { gsap } from 'gsap';
import { publishScene } from './capture.js';
import './style.css';

const stage = document.querySelector('#stage');
stage.innerHTML = `
  <header><div class="eyebrow">A change of perspective / 02</div><h1>Structure in motion.</h1>
  <div class="subtitle">One scene. A timeline. An explicit camera.</div></header>
  <div class="badge">THREE.JS / 3D</div>
  <div class="caption">The camera and geometry use the same animation clock.</div>`;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x0c1220);
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 9);
const sculpture = new THREE.Group();
sculpture.position.set(1.5, -0.15, 0);
scene.add(sculpture);

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0),
  new THREE.MeshStandardMaterial({ color: 0x6fe3c4, metalness: 0.25, roughness: 0.25 }));
sculpture.add(core);
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(core.geometry),
  new THREE.LineBasicMaterial({ color: 0xe6fff8 }));
core.add(edges);

for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5 + i * 0.25, 0.012, 8, 128),
    new THREE.MeshBasicMaterial({ color: [0x6fe3c4, 0x9dacf8, 0xf5c181][i] }));
  ring.rotation.set(i * Math.PI / 3, Math.PI / 3, i * Math.PI / 4);
  sculpture.add(ring);
}
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const light = new THREE.DirectionalLight(0xc7dcff, 4);
light.position.set(3, 5, 4);
scene.add(light);

const timeline = gsap.timeline({ paused: true })
  .fromTo(sculpture.rotation, { y: 0, z: -0.15 }, { y: Math.PI * 2, z: 0.25, duration: 6, ease: 'none' }, 0)
  .fromTo(camera.position, { z: 10 }, { z: 8, duration: 3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
gsap.ticker.sleep();

publishScene({ duration: 6, seek(seconds) {
  timeline.totalTime(seconds, true);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
} });
