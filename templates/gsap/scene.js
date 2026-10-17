import { gsap } from 'gsap';
import { publishScene } from './capture.js';
import './style.css';

document.querySelector('#stage').innerHTML = `
  <header><div class="eyebrow">Inside attention / 01</div><h1>One input. Three projections.</h1>
  <div class="subtitle">The same token becomes a query, a key, and a value.</div></header>
  <div class="badge">GSAP / 2D</div>
  <div class="diagram">
    <div class="input"><span>INPUT TOKEN</span><strong>x</strong><small>1 × d<sub>model</sub></small></div>
    <svg viewBox="0 0 1000 280" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 185 140 H 310 V 45 H 450 M 310 140 H 450 M 310 140 V 235 H 450" />
      <path class="flow" d="M 185 140 H 310 V 45 H 450 M 310 140 H 450 M 310 140 V 235 H 450" />
    </svg>
    <div class="outputs">
      <div class="projection q"><span>QUERY</span><strong>q = xW<sub>Q</sub></strong><small>What am I looking for?</small></div>
      <div class="projection k"><span>KEY</span><strong>k = xW<sub>K</sub></strong><small>What do I contain?</small></div>
      <div class="projection v"><span>VALUE</span><strong>v = xW<sub>V</sub></strong><small>What do I contribute?</small></div>
    </div>
  </div>
  <div class="caption"></div>`;

const style = document.createElement('style');
style.textContent = `
  .diagram { position:absolute; left:9%; right:9%; top:35%; height:43%; }
  .input { position:absolute; left:0; top:26%; width:19%; height:48%; border:1px solid #6587ae; border-radius:2vmin; background:#152238; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1vmin; }
  .input span,.projection span { font-size:1.6vmin; letter-spacing:.2em; }
  .input strong { font-size:7vmin; font-weight:400; }
  .input small,.projection small { font-size:1.8vmin; color:#a4b6cf; }
  svg { position:absolute; inset:0; width:100%; height:100%; z-index:-0; pointer-events:none; }
  path { fill:none; stroke:#2f435e; stroke-width:2; }
  .flow { stroke:#6fe3c4; stroke-dasharray:700; stroke-dashoffset:700; }
  .outputs { position:absolute; left:45%; right:0; top:0; bottom:0; display:flex; flex-direction:column; gap:2vmin; }
  .projection { flex:1; display:flex; align-items:center; justify-content:space-between; padding:0 3vmin; border:1px solid #34455e; background:#152238; border-radius:1.5vmin; }
  .projection strong { font-size:3vmin; font-weight:400; }
  .projection span { width:14%; }.q span {color:#6fe3c4}.k span {color:#9dacf8}.v span {color:#f5c181}
`;
document.head.append(style);

const timeline = gsap.timeline({ paused: true });
timeline.fromTo('.input', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.7 }, 0)
  .fromTo('.flow', { strokeDashoffset: 700 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, 0.7)
  .fromTo('.projection', { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.7 }, 1.4)
  .to({}, { duration: 2.5 });
gsap.ticker.sleep();

publishScene({
  duration: timeline.duration(),
  seek(seconds) {
    timeline.totalTime(seconds, true);
    document.querySelector('.caption').textContent = seconds < 1.4
      ? 'Start with one token vector, x.'
      : seconds < 2.8 ? 'Each learned weight matrix gives the token a different role.'
        : 'Queries compare with keys. Attention uses the scores to combine values.';
  },
});
