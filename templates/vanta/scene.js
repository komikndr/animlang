import * as THREE from 'three-vanta';
import 'vanta/dist/vanta.clouds.min.js';
import { publishScene } from './capture.js';
import './style.css';

const stage = document.querySelector('#stage');
stage.innerHTML = `
  <header><div class="eyebrow">A procedural atmosphere / 03</div><h1>A little room to think.</h1>
  <div class="subtitle">A Vanta background with an explicit shader clock.</div></header>
  <div class="badge">VANTA / CLOUDS</div>
  <div class="caption">The same timestamp gives the same clouds, in either seek direction.</div>`;

const effect = window.VANTA.CLOUDS({ el: stage, THREE, mouseControls: false, touchControls: false,
  gyroControls: false, mouseEase: false, scale: 2, scaleMobile: 2,
  skyColor: 0x234d70, cloudColor: 0x9cb4ce, cloudShadowColor: 0x142a48,
  sunColor: 0xf5c181, sunlightColor: 0xffd6a0, speed: 1 });

// This adapter is specific to CLOUDS in Vanta 0.5.24. Other effects can use simulations.
cancelAnimationFrame(effect.req);
effect.animationLoop = () => {};
if (!effect.uniforms?.iTime || !effect.renderer) throw new Error('Vanta CLOUDS did not initialize.');
const style = document.createElement('style');
style.textContent = `
  header,.caption { text-shadow:0 2px 16px #0c1220; }
  .eyebrow,.subtitle { color:#e0e9f3; }
  .caption { background:#0c1220bb; border:1px solid #93abc566; padding:2vmin; border-radius:1vmin; }
`;
document.head.append(style);

publishScene({ duration: 6, seek(seconds) {
  effect.uniforms.iTime.value = seconds;
  effect.uniforms.iMouse.value.set(effect.width / effect.scale / 2, effect.height / effect.scale / 2);
  effect.renderer.render(effect.scene, effect.camera);
} });
