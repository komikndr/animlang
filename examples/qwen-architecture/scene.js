import { gsap } from 'gsap';
import { publishScene } from '../shared/playback.js';
import { clamp, smooth, multiply, softmax, X, WQ, Q, K, V } from '../shared/math.js';
import './style.css';

const duration = 56;
const chapters = [
  { start: 0, end: 5, label: 'SYSTEM MAP', title: 'Qwen3.8-Flash-Next', sub: 'Follow one token through a hybrid language model.', color: '#70ddd8' },
  { start: 5, end: 14, label: '01 / EMBED', title: 'From token IDs to hidden vectors.', sub: 'Vocabulary lookup · n-gram memory at layer 2 · expanded residual stream', color: '#b9a0ef' },
  { start: 14, end: 24, label: '02 / GDN', title: 'A compact memory, updated one token at a time.', sub: 'Gated DeltaNet · three layers in every four-layer group', color: '#7ee2b3' },
  { start: 24, end: 36, label: '03 / QSA', title: 'Look far. Read selectively.', sub: 'Qwen Sparse Attention · index micro-blocks before attention', color: '#efc987' },
  { start: 36, end: 44, label: '04 / LM HEAD', title: 'Turn the final hidden state into a word.', sub: 'Final gated-residual read → vocabulary projection → probabilities', color: '#72dbeb' },
  { start: 44, end: 51, label: '05 / MTP', title: 'Learn to look more than one token ahead.', sub: 'One additional MTP layer · trained with multi-step prediction', color: '#e19de8' },
  { start: 51, end: 56, label: 'SYSTEM MAP', title: 'Local memory. Sparse recall. One next token.', sub: 'A hybrid path from embeddings to predictions.', color: '#70ddd8' },
];

function matrix(id, label, data, size = 48) {
  return `<div class="matrix" id="${id}"><div class="matrix-title">${label}<span class="shape">${data.length} × ${data[0].length}</span></div><div class="cells" style="--cols:${data[0].length};--cell:${size}px">${data.flatMap((row, r) => row.map((value, c) => `<div class="cell" data-r="${r}" data-c="${c}">${Number.isInteger(value) ? value : value.toFixed(1)}</div>`)).join('')}</div></div>`;
}
const embedding = [[0, 1, 0, 0], X[0], [1, -1, 1, 0], X[1], [0, 0, 1, 1], X[2]];
const oneHot = [1, 3, 5].map(index => Array.from({ length: 6 }, (_, i) => Number(i === index)));
const outWeights = [[0, 1, -1, 0, 1, 0], [1, -1, 0, 1, 0, 0], [0, 0, 1, 0, -1, 1], [0, 1, 0, -1, 1, 0]];
const hidden = [X[2]];
const logits = multiply(hidden, outWeights)[0];
const probabilities = softmax(logits);
const words = ['the', 'neon', 'rain', 'quiet', 'city', 'glows'];
const topIndex = probabilities.indexOf(Math.max(...probabilities));
const selectedBlocks = [1, 4, 7, 10];
const blockScores = [0.21, 0.94, 0.08, 0.35, 0.88, 0.17, 0.22, 0.97, 0.11, 0.30, 0.82, 0.07];
const memoryStates = [[[0.4,0.2,-0.1],[0.1,0.6,0.3],[0.2,-0.2,0.5]]];
for (let token=0;token<3;token++) {
  const norm=Math.hypot(...K[token]);
  const key=K[token].map(value=>value/norm);
  const decayed=memoryStates.at(-1).map(row=>row.map(value=>value*.83));
  const delta=V[token].map((value,column)=>value-key.reduce((sum,k,row)=>sum+k*decayed[row][column],0));
  memoryStates.push(decayed.map((row,r)=>row.map((value,c)=>value+.72*key[r]*delta[c])));
}

document.querySelector('#stage').innerHTML = `
  <div class="frame-corner tl"></div><div class="frame-corner br"></div>
  <header><div class="eyebrow">ANIMLANG LAB / MODEL ANATOMY</div><h1></h1><div class="dek"></div></header>
  <div class="serial"><b>QWEN / 3.8 FLASH NEXT</b><br>ARCHITECTURE STUDY · 001</div>
  <div id="overview">
    <div class="overview-title"><b>One forward pass</b> / five places to look inside</div>
    <div class="overview-stats"><div><strong>48</strong><small>HYBRID LAYERS</small></div><div><strong>2,560</strong><small>HIDDEN DIMENSION</small></div><div><strong>4</strong><small>RESIDUAL BRANCHES</small></div></div>
    <div class="rail">
      ${[
        ['01','Embedding','Vocabulary + n-gram lookup','Token IDs → hidden vectors','▦ ▦ ▦','#b9a0ef'],
        ['02','Gated DeltaNet','Recurrent, gated memory','Three GDN layers per group','q · k · v','#7ee2b3'],
        ['03','Qwen Sparse Attn','Index → select → attend','One QSA layer per group','▤ ▥ ▤','#efc987'],
        ['04','LM head','Final GR read + projection','248,320 vocabulary logits','h × W → z','#72dbeb'],
        ['05','MTP','Auxiliary look-ahead path','One layer, multi-step training','t+1 → t+2','#e19de8'],
      ].map(([number,title,a,b,glyph,color]) => `<div class="node" style="--accent:${color}"><div class="stripe"></div><div class="num">${number} / INSIDE THE MODEL</div><h2>${title}</h2><p>${a}<br>${b}</p><div class="glyph">${glyph}</div></div>`).join('')}
    </div>
    <div class="repeat">[ GDN → MoE ] × 3 + [ QSA → MoE ] × 1 <b>⟲ 12 groups</b></div>
    <svg class="mtp-branch" viewBox="0 0 1720 90"><path d="M 856 76 V 25 H 1552 V 76"/><text x="1110" y="15">AUXILIARY MTP PATH</text></svg>
    <div class="ngram-tag">+ N-GRAM LOOKUP<br>  AT LAYER 2</div>
  </div>

  <section class="detail" id="embed" style="--accent:#b9a0ef">
    <div class="panel embed-main"><div class="panel-tag">LOOKUP AS A MATRIX PRODUCT / REDUCED TENSORS</div>
      <div class="row">${matrix('onehot','Token IDs → one-hot',oneHot,36)}<span class="operator">×</span>${matrix('etable','Embedding table E',embedding,34)}<span class="operator">=</span>${matrix('embedded','Hidden vectors X',X,42)}</div>
      <div class="equation-box formula" id="embed-equation"></div>
    </div>
    <div class="panel embed-aside"><div class="panel-tag">THE SEQUENCE ENTERS THE MODEL</div>
      <div class="token-line"><div class="token">The<b>toy ID 1</b></div><div class="token">future<b>toy ID 3</b></div><div class="token">glows<b>toy ID 5</b></div></div>
      <p class="large">Select a row.<br>Keep all its features.</p><p class="small muted">Real vocabulary table:<br><span class="mono accent">248,320 × 2,560</span></p>
      <div class="micro-note">A lookup gathers rows; no dense one-hot is needed.</div>
    </div>
    <div class="footnote"><div class="panel"><div class="panel-tag">N-GRAM EMBEDDING / LAYER 2</div><div class="small">Bigram + trigram context indexes a separate memory.<br><span class="accent mono">20,000,000 base entries</span> enrich local token features.</div></div>
      <div class="panel"><div class="panel-tag">EXPANDED RESIDUAL STREAM</div><div class="row"><div class="small muted">Four branches carry information.<br>GR Read mixes them; GR Write updates them.</div><div class="four-branches"><i>r₁</i><i>r₂</i><i>r₃</i><i>r₄</i></div></div></div></div>
  </section>

  <section class="detail" id="gdn" style="--accent:#7ee2b3">
    <div class="panel gdn-top"><div class="panel-tag">LEARNED PROJECTIONS / ROW × COLUMN → ONE OUTPUT CELL</div>
      <div class="projection-row">${matrix('gdn-x','Hidden vectors X',X,34)}<span class="operator">×</span>${matrix('gdn-w','Query weights WQ',WQ,34)}<span class="operator">=</span>${matrix('gdn-q','Queries Q',Q,34)}<div class="operator">↗</div><div class="small muted">Separate learned maps also form<br><span class="mono accent">K = XWK &nbsp; V = XWV</span><br><br>Real GDN: 16 Q/K heads,<br>48 value heads, 128 features per head.</div></div>
    </div>
    <div class="gdn-bottom"><div class="panel"><div class="panel-tag">RECURRENT STATE / ONE HEAD, TOY SIZE</div><div class="state-row">${matrix('state','Memory Sₜ',[[0.4,0.2,-0.1],[0.1,0.6,0.3],[0.2,-0.2,0.5]],43)}<div class="small muted">Forget stale state.<br>Correct a prediction.<br>Read with the query.<div class="gates"><div class="gate">α = 0.83</div><div class="gate">β = 0.72</div></div></div></div></div>
      <div class="panel"><div class="panel-tag">CORE DELTA UPDATE / SCHEMATIC</div><div class="formula">Ŝₜ = αₜ Sₜ₋₁ &nbsp; · &nbsp; δₜ = vₜ − Ŝₜᵀkₜ<br>Sₜ = Ŝₜ + βₜ kₜ δₜᵀ &nbsp; → &nbsp; oₜ = Sₜᵀqₜ</div><div class="micro-note">Convolution, normalization, and the output gate are omitted here.</div><div class="small muted" style="margin-top:13px">Then: GR Write → GR Read → MoE → GR Write.<br><span class="accent">512 experts: 10 routed + 1 shared active per token.</span></div></div></div>
  </section>

  <section class="detail" id="qsa" style="--accent:#efc987">
    <div class="panel qsa-left"><div class="panel-tag">MICRO-BLOCK INDEXER / ONE QUERY POSITION</div><div class="row"><div class="large">Score blocks. Keep the relevant ones.</div><div class="mono accent">4 TOKENS / BLOCK</div></div>
      <div class="blocks">${blockScores.map((score,index) => `<div class="block" data-block="${index}">B${String(index).padStart(2,'0')}<div class="slots"><i></i><i></i><i></i><i></i></div><span>score ${score.toFixed(2)}</span></div>`).join('')}</div>
      <div class="equation-box"><div class="formula">12 toy blocks → top 4 illustrated</div><div class="small muted">Real selection budget: <span class="accent">up to 512 micro-blocks / 2,048 tokens</span></div></div>
      <div class="micro-note">The causal mask excludes future tokens. This grid illustrates past context.</div>
    </div>
    <div class="panel qsa-right"><div class="panel-tag">ATTENTION WITHIN THE SELECTED CONTEXT</div><div class="row">${matrix('qsa-q','Q',Q,40)}<span class="operator">·</span>${matrix('qsa-k','K',K,40)}<span class="operator">·</span>${matrix('qsa-v','V',V,40)}</div>
      <div class="attention-formula">scores = QKᵀ / √d<br>weights = softmax(scores + mask)<br>context = weights × V</div>
      <div class="equation-box"><div class="large accent">24 query heads / 2 KV heads</div><div class="small muted" style="margin-top:9px">256 features per head.<br>Four indexer query heads share one key head.<br>RoPE uses 64 of the head dimensions.</div></div>
      <div class="micro-note">Projection tensors are toy values; dimensions here are model values.</div>
    </div>
  </section>

  <section class="detail" id="head" style="--accent:#72dbeb">
    <div class="panel lm-main"><div class="panel-tag">VOCABULARY PROJECTION / THE LAST TOKEN POSITION</div><div class="row">${matrix('head-h','Final hidden vector h',hidden,43)}<span class="operator">×</span>${matrix('head-w','Output weights Wout',outWeights,43)}<span class="operator">=</span>${matrix('head-z','Logits z',[logits],43)}</div></div>
    <div class="lm-bottom"><div class="panel"><div class="panel-tag">SOFTMAX / COMPUTED FROM THE TOY LOGITS</div><div class="distribution">${words.map((word,index) => `<div class="bar-col ${index === topIndex ? 'winner' : ''}"><div class="prob">${(probabilities[index]*100).toFixed(1)}%</div><div class="bar" data-prob="${probabilities[index]}"></div><span>${word}</span></div>`).join('')}</div></div>
      <div class="panel"><div class="panel-tag">NEXT-TOKEN DISTRIBUTION</div><div class="prediction">${words[topIndex]} <small>/ toy argmax</small></div><div class="small muted">Real output projection:<br><span class="mono accent">[1 × 2,560] × [2,560 × 248,320]</span><br>Sampling selects a token from this distribution.</div></div></div>
  </section>

  <section class="detail" id="mtp" style="--accent:#e19de8">
    <div class="panel mtp-main"><div class="step-card"><div class="label">01 / BACKBONE</div><h3>Hidden state hₜ</h3><p>The hybrid model carries context up to position t.</p></div><span class="operator">+</span><div class="step-card"><div class="label">02 / TOKEN INPUT</div><h3>Embed the next token</h3><p>Shift the input by one position for the auxiliary prediction path.</p></div><span class="operator">→</span><div class="step-card"><div class="label">03 / ONE MTP LAYER</div><h3>Fuse + transform</h3><p>A dedicated layer learns to extend the predictive horizon.</p></div><span class="operator">→</span><div class="step-card"><div class="label">04 / LOOK-AHEAD</div><h3>Future-token logits</h3><p>Multi-step training teaches predictions beyond the immediate token.</p></div></div>
    <div class="footnote" style="height:205px"><div class="panel"><div class="panel-tag">PREDICTIVE HORIZON / SCHEMATIC</div><div class="future-tokens"><span>context … t</span><span>t + 1</span><span>t + 2</span><span>…</span></div><div class="micro-note">One MTP layer is trained with multiple steps, rather than adding many backbone layers.</div></div><div class="panel"><div class="panel-tag">WHY IT EXISTS</div><div class="large">A useful look-ahead signal.</div><div class="small muted" style="margin-top:12px">Auxiliary predictions can support speculative decoding.<br>Verification and acceptance depend on the inference implementation.</div></div></div>
  </section>

  <footer><div class="caption"></div><div class="time"></div><div class="chapter-strip">${['OVERVIEW','EMBED','GDN','QSA','LM HEAD','MTP'].map((label,index) => `<div class="chapter" data-index="${index}">${label}</div>`).join('')}</div><div class="source">SOURCE: QWEN MODEL CARD + CONFIG · TOY TENSORS, NOT MODEL WEIGHTS</div></footer>`;

const stage = document.querySelector('#stage');
const overview = document.querySelector('#overview');
const detailIds = ['embed','gdn','qsa','head','mtp'];
const camera = { x: 0, y: 0, scale: 1 };
const timeline = gsap.timeline({ paused: true });
// The diagram camera pushes into each architecture node before its detail appears.
for (let index = 0; index < 5; index++) {
  const start = chapters[index + 1].start;
  const centerX = 260 + index * 348;
  timeline.fromTo(camera, { x: 0, y: 0, scale: 1 }, {
    x: 960 - centerX * 2.8, y: 540 - 557 * 2.8, scale: 2.8, duration: 1.15, ease: 'power3.inOut',
    immediateRender: false,
  }, start);
}
timeline.to({}, { duration: 5 }, 51);
gsap.ticker.sleep();

function paintMatrix(id, { row = -1, column = -1, revealed = Infinity, pivot = false } = {}) {
  const cells = document.querySelectorAll(`#${id} .cell`);
  cells.forEach((cell, index) => {
    const active = Number(cell.dataset.r) === row || Number(cell.dataset.c) === column;
    cell.className = `cell${index >= revealed ? ' hidden' : ' answer'}${active ? pivot ? ' pivot' : ' active' : ''}`;
  });
}

function resize() {
  stage.style.transform = `scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;
}
addEventListener('resize', resize);
resize();

function seek(time) {
  timeline.totalTime(0, true);
  timeline.totalTime(time, true);
  const chapterIndex = chapters.findIndex((chapter,index) => time >= chapter.start && (time < chapter.end || index === chapters.length-1));
  const chapter = chapters[Math.max(0,chapterIndex)];
  const local = time-chapter.start;
  const overviewMode = chapterIndex === 0 || chapterIndex === 6;
  const entrance = smooth((local-0.45)/0.9);
  const exit = smooth((chapter.end-time)/0.45);
  stage.style.setProperty('--accent',chapter.color);
  document.querySelector('h1').textContent = chapter.title;
  document.querySelector('.dek').textContent = chapter.sub;
  document.querySelector('.eyebrow').textContent = `ANIMLANG LAB / ${chapter.label}`;
  document.querySelector('.time').textContent = `${String(Math.floor(time)).padStart(2,'0')} / 56 SEC`;
  overview.style.opacity = overviewMode ? 1 : 1-entrance;
  overview.style.transform = overviewMode ? 'none' : `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
  detailIds.forEach((id,index) => {
    const panel = document.getElementById(id);
    const active = chapterIndex === index+1;
    panel.style.opacity = active ? entrance*exit : 0;
    panel.style.transform = `translateY(${(1-entrance)*65}px) scale(${0.84+entrance*0.16})`;
  });
  document.querySelectorAll('.chapter').forEach((element,index) => element.classList.toggle('current', index === (overviewMode ? 0 : chapterIndex)));

  const e = clamp((time-6.5)/6.0)*12;
  const embedCell = Math.min(11,Math.floor(e));
  const er = Math.floor(embedCell/4), ec = embedCell%4;
  paintMatrix('onehot',{row:er});
  paintMatrix('etable',{column:ec,row:[1,3,5][er],pivot:true});
  paintMatrix('embedded',{row:er,column:ec,revealed:Math.min(12,Math.floor(e)+1)});
  document.querySelector('#embed-equation').innerHTML = `<span class="accent">X[${er},${ec}]</span> = one-hot[${[1,3,5][er]}] · E[:,${ec}] = <span class="accent">${X[er][ec]}</span><span class="dim"> &nbsp; / one row, one feature</span>`;

  const g = clamp((time-15.5)/5.8)*9;
  const gr = Math.floor(Math.min(8,Math.floor(g))/3), gc = Math.min(8,Math.floor(g))%3;
  paintMatrix('gdn-x',{row:gr});paintMatrix('gdn-w',{column:gc,pivot:true});paintMatrix('gdn-q',{row:gr,column:gc,revealed:Math.floor(g)+1});
  paintMatrix('state',{row:Math.min(2,Math.floor(clamp((time-20)/2)*3))});
  const stateProgress=clamp((time-20)/2.6)*3;
  const stateIndex=Math.min(2,Math.floor(stateProgress));
  const stateBlend=smooth(stateProgress-stateIndex);
  document.querySelectorAll('#state .cell').forEach(cell=>{
    const r=Number(cell.dataset.r),c=Number(cell.dataset.c);
    cell.textContent=(memoryStates[stateIndex][r][c]*(1-stateBlend)+memoryStates[stateIndex+1][r][c]*stateBlend).toFixed(1);
  });
  const scan = Math.floor(clamp((time-25.5)/3)*12);
  document.querySelectorAll('.block').forEach((element,index) => {
    element.classList.toggle('scanning',scan === index && time < 29);
    element.classList.toggle('selected',time >= 29 && selectedBlocks.includes(index));
  });
  ['qsa-q','qsa-k','qsa-v'].forEach(id => paintMatrix(id,{row:time > 31 ? 2 : -1}));
  const h = Math.min(5,Math.floor(clamp((time-37.5)/3.8)*6));
  paintMatrix('head-h',{row:0});paintMatrix('head-w',{column:h,pivot:true});paintMatrix('head-z',{column:h,revealed:h+1});
  document.querySelectorAll('.bar').forEach(element => {
    element.style.height = `${Number(element.dataset.prob)/Math.max(...probabilities)*90*smooth((time-40.8)/1.1)}px`;
  });
  document.querySelectorAll('.step-card').forEach((element,index) => element.classList.toggle('active', local >= 1+index*.9 && chapterIndex === 5));
  document.querySelectorAll('.future-tokens span').forEach((element,index) => {element.style.opacity = chapterIndex === 5 ? 0.25+0.75*smooth((local-index*.7-1)/.6) : 1;});

  const captions = [
    'A token enters through embeddings, crosses 12 hybrid groups, then reaches the prediction and MTP heads.',
    local < 5.8 ? 'An embedding lookup selects a learned feature vector for each token. Watch one row become one output.' : 'Layer 2 adds short n-gram context. Four gated residual branches carry the representation through the model.',
    local < 6.5 ? 'Multiply a token row by each weight column. Separate projections produce queries, keys, and values.' : 'Gated DeltaNet updates a compact recurrent state. Gated residual reads and writes wrap the attention and MoE paths.',
    local < 5 ? 'The indexer scores four-token micro-blocks, rather than selecting isolated tokens.' : local < 8 ? 'Keep the highest-scoring blocks within the budget. Sparse recall avoids reading the whole context.' : 'Within the selected causal context, queries compare with keys; normalized scores combine the values.',
    local < 4.5 ? 'After the final GR Read, multiply the last hidden vector by the vocabulary output matrix.' : 'Softmax turns logits into probabilities. The sampler chooses the next token from that distribution.',
    'The MTP path combines hidden-state context with shifted token inputs to learn future-token predictions.',
    'Embeddings provide features. GDN carries local memory. QSA retrieves context. The heads predict what comes next.',
  ];
  document.querySelector('.caption').textContent = captions[Math.max(0,chapterIndex)];
}

publishScene(duration,seek);
