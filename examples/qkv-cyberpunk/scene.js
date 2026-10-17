import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { publishScene } from '../shared/playback.js';
import { clamp, smooth, X, WQ, WK, WV, Q, K, V } from '../shared/math.js';
import './style.css';

const duration = 32;
const colors = [0x48efe7,0xff56c8,0xc8f46b];
const cssColors = colors.map(color => `#${color.toString(16).padStart(6,'0')}`);
const letters = ['Q','K','V'];
const weights = [WQ,WK,WV];
const results = [Q,K,V];
const stage = document.querySelector('#stage');
document.querySelector('#hud').innerHTML = `
  <div class="vignette"></div><div class="bracket a"></div><div class="bracket b"></div>
  <header><div class="eyebrow">NEURAL SYSTEMS / PROJECTION CHAMBER</div><h1>One signal. <span>Three identities.</span></h1><div class="sub">Q / K / V &nbsp; — &nbsp; a spatial view of learned matrix projections</div></header>
  <div class="system"><b><i class="live-dot"></i>NEON LAB / ONLINE</b><br>ABSOLUTE CLOCK · DETERMINISTIC<br>03 TOKENS / 04 INPUT FEATURES</div>
  <div class="sidebar"><div class="sidebar-title">PROJECTION CHANNELS</div>${letters.map((letter,index) => `<div class="channel" style="--color:${cssColors[index]}"><small>0${index+1} / LEARNED MAP</small><br><b>${letter} = XW${letter}</b><span>${['Query / what to look for','Key / what can match','Value / what to carry'][index]}</span></div>`).join('')}</div>
  <div id="labels"></div><div class="readout"><div class="formula-block"><div class="tag"></div><div class="equation"></div></div><div class="explanation"></div></div>
  <footer><div class="caption"></div><div class="time"></div><div class="tiny">TOY TENSORS · COMPUTED PRODUCTS · DISPLAY DEPTH IS SCHEMATIC</div><div class="progress-track"><div class="progress"></div></div></footer>`;

const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(1);
renderer.setSize(1920,1080);
renderer.setClearColor(0x040711);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.querySelector('#webgl').append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040711,0.018);
const camera = new THREE.PerspectiveCamera(39,1920/1080,0.1,150);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(960,540),0.42,0.4,0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const rig = new THREE.Group();
rig.position.set(2.5,0.4,0);
scene.add(rig);
scene.add(new THREE.AmbientLight(0x8eafff,1.7));
const keyLight = new THREE.DirectionalLight(0x85eaff,3);
keyLight.position.set(-5,10,9);scene.add(keyLight);
const pinkLight = new THREE.PointLight(0xff30a6,35,30);
pinkLight.position.set(6,4,4);scene.add(pinkLight);

const grid = new THREE.GridHelper(100,100,0x244a67,0x10233c);
grid.position.y = -5.5;scene.add(grid);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(110,110),new THREE.MeshStandardMaterial({color:0x050812,metalness:0.65,roughness:0.4,transparent:true,opacity:.75}));
floor.rotation.x = -Math.PI/2;floor.position.y = -5.56;scene.add(floor);

// Seeded analytic particles: no simulation or wall-clock state enters a frame.
let seed = 3708;
const random = () => ((seed = Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
const starPositions = new Float32Array(900*3);
for (let index=0;index<900;index++) {
  starPositions[index*3] = (random()-.5)*70;
  starPositions[index*3+1] = (random()-.5)*35;
  starPositions[index*3+2] = -12-random()*40;
}
const starGeometry = new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
const stars = new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0x619bc7,size:.045,transparent:true,opacity:.55}));scene.add(stars);

// Static skyline frames add depth without competing with the matrix arithmetic.
const skyline = new THREE.Group();scene.add(skyline);
for (let index=0;index<22;index++) {
  const height = 2+random()*9;
  const building = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5+random()*2,height,2)),new THREE.LineBasicMaterial({color:index%3===0?0x53325b:0x19324a,transparent:true,opacity:.65}));
  building.position.set((index-11)*3,-5.5+height/2,-15-random()*10);skyline.add(building);
}

const cubeGeometry = new THREE.BoxGeometry(.48,.48,.32);
const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
function numberSprite(value,color) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const context=canvas.getContext('2d');
  context.font='600 68px monospace';context.textAlign='center';context.textBaseline='middle';context.fillStyle=color;context.fillText(String(value),64,68);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,toneMapped:false}));sprite.scale.set(.44,.44,1);
  return sprite;
}
const labels=[];
function labelFor(group,text,color,offset) {
  const element=document.createElement('div');element.className='label';element.style.setProperty('--color',color);element.innerHTML=text;
  document.querySelector('#labels').append(element);labels.push({group,element,offset});
}
function makeMatrix(data,position,color,label) {
  const group=new THREE.Group();group.position.set(...position);rig.add(group);
  const cells=[];const width=data[0].length*.64;const height=data.length*.64;
  const backing=new THREE.Mesh(new THREE.BoxGeometry(width+.35,height+.35,.08),new THREE.MeshStandardMaterial({color:0x091628,metalness:.4,roughness:.45,transparent:true,opacity:.88}));backing.position.z=-.18;group.add(backing);
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(backing.geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity:.65}));outline.position.copy(backing.position);group.add(outline);
  data.forEach((row,r)=>row.forEach((value,c)=>{
    const material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.12,metalness:.4,roughness:.3,transparent:true,opacity:.4});
    const cube=new THREE.Mesh(cubeGeometry,material);cube.position.set((c-(row.length-1)/2)*.64,((data.length-1)/2-r)*.64,.05);
    const edges=new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.75}));cube.add(edges);
    const digit=numberSprite(value,'#e4f5ff');digit.position.copy(cube.position);digit.position.z=.32;group.add(cube,digit);
    cells.push({cube,digit,r,c,material,edges,value});
  }));
  const css=`#${color.toString(16).padStart(6,'0')}`;
  labelFor(group,`${label}<small>${data.length} × ${data[0].length}</small>`,css,new THREE.Vector3(0,height/2+.8,0));
  return {group,cells,data};
}
const input=makeMatrix(X,[-5.3,0,0],0x8da9ef,'X / INPUT');
const maps=weights.map((data,index)=>makeMatrix(data,[0,3.3-index*3.3,0],colors[index],`W${letters[index]} / WEIGHTS`));
const outputs=results.map((data,index)=>makeMatrix(data,[5.2,3.3-index*3.3,0],colors[index],`${letters[index]} / PROJECTED`));

// In the final shot, each three-feature row becomes an actual 3D vector.
const vectorRoot=new THREE.Group();vectorRoot.position.set(2.5,.4,0);scene.add(vectorRoot);
const vectorSpaces=results.map((data,index)=>{
  const space=new THREE.Group();space.position.set((index-1)*5.3,0,0);vectorRoot.add(space);
  const bounds=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.4,4.4,4.4)),new THREE.LineBasicMaterial({color:colors[index],transparent:true,opacity:.15}));space.add(bounds);
  for(const direction of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)]) {
    space.add(new THREE.ArrowHelper(direction,new THREE.Vector3(),2.3,0x496180,.13,.06));
  }
  data.forEach((row,token)=>{
    const endpoint=new THREE.Vector3(...row).multiplyScalar(.61);
    const color=new THREE.Color(colors[index]).lerp(new THREE.Color(0xffffff),token*.18);
    space.add(new THREE.ArrowHelper(endpoint.clone().normalize(),new THREE.Vector3(),endpoint.length(),color,.22,.11));
    const point=new THREE.Mesh(new THREE.SphereGeometry(.10,12,8),new THREE.MeshBasicMaterial({color}));point.position.copy(endpoint);space.add(point);
    const digit=numberSprite(token,'#e8f6ff');digit.position.copy(endpoint).add(new THREE.Vector3(.2,.22,0));digit.scale.set(.35,.35,1);space.add(digit);
  });
  labelFor(space,`${letters[index]} / ${['QUERY','KEY','VALUE'][index]} SPACE<small>3 TOKENS · 3 FEATURES</small>`,cssColors[index],new THREE.Vector3(0,3.1,0));
  return space;
});

const paths=[];const packets=[];
for(let index=0;index<3;index++) {
  const y=3.3-index*3.3;
  const first=new THREE.CubicBezierCurve3(new THREE.Vector3(-3.8,0,0),new THREE.Vector3(-2.8,0,0),new THREE.Vector3(-2.4,y,0),new THREE.Vector3(-1.5,y,0));
  const second=new THREE.CubicBezierCurve3(new THREE.Vector3(1.4,y,0),new THREE.Vector3(2.4,y,.6),new THREE.Vector3(3,y,.6),new THREE.Vector3(4,y,0));
  for(const curve of [first,second]) {
    const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),new THREE.LineBasicMaterial({color:colors[index],transparent:true,opacity:.28}));rig.add(mesh);
    paths.push({mesh,index,curve,inputSide:curve===first});
    for(let j=0;j<3;j++) {
      const packet=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:colors[index]}));rig.add(packet);
      packets.push({mesh:packet,curve,index,offset:j/3});
    }
  }
}

const rings=[];
for(let index=0;index<3;index++) {
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.1+index*.2,.013,5,180,Math.PI*1.6),new THREE.MeshBasicMaterial({color:index===1?0x763e7b:0x225a70,transparent:true,opacity:.65}));
  ring.position.set(-5.3,0,-.65);ring.rotation.set(.12+index*.22,index*.2,index*.9);rig.add(ring);rings.push(ring);
}

const motion={x:12,y:6.5,z:24,lookX:2,lookY:0};
const timeline=gsap.timeline({paused:true});
timeline.fromTo(motion,{x:12,y:6.5,z:24,lookX:2,lookY:0},{x:7,y:3.5,z:22,lookX:2.4,lookY:.4,duration:5,ease:'power2.inOut'},0)
  .to(motion,{x:6,y:6,z:20,lookX:3,lookY:3.7,duration:2,ease:'power2.inOut'},5)
  .to(motion,{x:7,y:3,z:20,lookX:3,lookY:.4,duration:1.8,ease:'power2.inOut'},12)
  .to(motion,{x:8,y:.2,z:20,lookX:3,lookY:-2.9,duration:1.8,ease:'power2.inOut'},19)
  .to(motion,{x:11,y:6,z:23,lookX:2.2,lookY:.3,duration:3,ease:'power2.inOut'},26)
  .to({}, {duration:3},29);
gsap.ticker.sleep();

function resize() {stage.style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;}
addEventListener('resize',resize);resize();
const projected=new THREE.Vector3();
function paint(matrix,kind,channel,local) {
  const progress=clamp((local-1)/4.8)*9;
  const current=Math.min(8,Math.floor(progress));const row=Math.floor(current/3),column=current%3;
  matrix.cells.forEach(cell=>{
    const focused=activeChannel>=0&&activeChannel<3&&(kind==='input'||channel===activeChannel);
    const active=focused&&(kind==='input'?cell.r===row:kind==='weight'?cell.c===column:cell.r===row&&cell.c===column);
    const revealed=kind!=='output'||channel<activeChannel||channel===activeChannel&&cell.r*3+cell.c<=Math.floor(progress)||timeNow>=26;
    cell.material.opacity=revealed?(active ? .82 : .38):.1;
    cell.material.emissiveIntensity=revealed?(active ? .38 : .10):.02;
    cell.digit.material.opacity=revealed?1:.08;
    cell.edges.material.opacity=active ? .95 : .4;
    const depth=active&&revealed ? .16 : 0;
    cell.cube.position.z=.05+depth;cell.digit.position.z=.32+depth;
  });
}
let activeChannel=-1;let timeNow=0;
function seek(time) {
  timeNow=time;timeline.totalTime(0,true);timeline.totalTime(time,true);
  activeChannel=time<5?-1:time<12?0:time<19?1:time<26?2:3;
  const local=activeChannel>=0&&activeChannel<3?time-(5+activeChannel*7):0;
  const focused=activeChannel>=0&&activeChannel<3;
  const focus=smooth((time-5)/1.4)*(1-smooth((time-26)/2));
  rig.scale.setScalar(.62+.38*focus);
  rig.visible=time<27;
  vectorRoot.visible=time>=27;
  vectorRoot.scale.setScalar(.6+.4*smooth((time-27)/1.5));
  vectorRoot.rotation.y=(time-27)*.12;
  const inputY=focused?3.3-activeChannel*3.3:0;
  input.group.position.y=inputY;
  rings.forEach(ring=>{ring.position.y=inputY;});
  maps.forEach((matrix,index)=>{matrix.group.visible=!focused||index===activeChannel;});
  outputs.forEach((matrix,index)=>{matrix.group.visible=!focused||index===activeChannel;});
  stage.style.setProperty('--accent',cssColors[Math.min(2,Math.max(0,activeChannel))]);
  camera.position.set(motion.x,motion.y,motion.z);camera.lookAt(motion.lookX,motion.lookY,0);
  rig.rotation.y=Math.sin(time*.14)*.055;
  stars.rotation.y=time*.003;
  rings.forEach((ring,index)=>{ring.rotation.z=index*.9+time*(.08+index*.025);});
  paint(input,'input',0,local);
  maps.forEach((matrix,index)=>paint(matrix,'weight',index,index===activeChannel?local:0));
  outputs.forEach((matrix,index)=>paint(matrix,'output',index,index===activeChannel?local:0));
  paths.forEach(({mesh,index,curve,inputSide})=>{
    mesh.visible=!focused||index===activeChannel;
    mesh.material.opacity=index===activeChannel||activeChannel===3 ? .75 : .18;
    if(inputSide){curve.v0.y=inputY;curve.v1.y=inputY;mesh.geometry.setFromPoints(curve.getPoints(48));}
  });
  packets.forEach(({mesh,curve,index,offset})=>{
    const phase=(time*.4+offset)%1;mesh.position.copy(curve.getPoint(phase));
    mesh.visible=activeChannel===index||activeChannel===3;
  });
  document.querySelectorAll('.channel').forEach((element,index)=>element.classList.toggle('current',activeChannel===index||activeChannel===3));
  const current=Math.min(8,Math.floor(clamp((local-1)/4.8)*9));const row=Math.floor(current/3),column=current%3;
  let tag,equation,explanation,caption;
  if(activeChannel<0) {
    tag='BOOT SEQUENCE / THE SAME INPUT, THREE LEARNED MAPS';
    equation='<em>X</em> [3 × 4] &nbsp; × &nbsp; <em>WQ / WK / WV</em> [4 × 3]';
    explanation='Each token begins with one feature vector.<br><b>Different weight matrices give it different roles.</b>';
    caption='Enter the projection chamber. The input matrix contains three token vectors, each with four features.';
  } else if(activeChannel<3) {
    const letter=letters[activeChannel];const terms=X[row].map((value,index)=>`${value<0?`(${value})`:value}·${weights[activeChannel][index][column]<0?`(${weights[activeChannel][index][column]})`:weights[activeChannel][index][column]}`).join(' + ');
    tag=`CHANNEL 0${activeChannel+1} / ${letter} = XW${letter} / ROW ${row} × COLUMN ${column}`;
    equation=`${letter}[${row},${column}] = ${terms} = <em>${results[activeChannel][row][column]}</em>`;
    explanation=`The highlighted <b>input row</b> meets the highlighted <b>weight column</b>.<br>Four products sum to one projected feature.`;
    caption=[
      'QUERY / A learned projection defines what each token looks for. Watch each row–column dot product fill Q.',
      'KEY / The same input passes through a different weight matrix. Keys define the features that queries can match.',
      'VALUE / A third learned map produces the information that attention will combine after query–key matching.',
    ][activeChannel];
  } else {
    tag='PROJECTION COMPLETE / THREE LEARNED FEATURE SPACES';
    equation='xᵢWQ → <em>qᵢ</em> &nbsp; / &nbsp; xᵢWK → <em>kᵢ</em> &nbsp; / &nbsp; xᵢWV → <em>vᵢ</em>';
    explanation='Each arrow shows one computed output row<br>as a <b>three-dimensional feature vector</b>.';
    caption='The same three tokens occupy different learned spaces. Next, query–key scores determine how value vectors combine.';
  }
  document.querySelector('.tag').textContent=tag;
  document.querySelector('.equation').innerHTML=equation;
  document.querySelector('.explanation').innerHTML=explanation;
  document.querySelector('.caption').textContent=caption;
  document.querySelector('.time').textContent=`${String(Math.floor(time)).padStart(2,'0')} / 32 SEC`;
  document.querySelector('.progress').style.transform=`scaleX(${time/duration})`;
  camera.updateMatrixWorld();scene.updateMatrixWorld(true);
  labels.forEach(({group,element,offset})=>{
    projected.copy(offset);group.localToWorld(projected);projected.project(camera);
    element.style.left=`${(projected.x*.5+.5)*1920}px`;
    element.style.top=`${(-projected.y*.5+.5)*1080}px`;
    let visible=true;
    for(let parent=group;parent;parent=parent.parent) visible=visible&&parent.visible;
    element.style.opacity=visible&&projected.z<1&&projected.z>-1?1:0;
    element.classList.toggle('overview-label',!focused&&time<27);
  });
  // Fixed delta: the composer must not use its internal wall-clock timer.
  composer.render(0);
}
publishScene(duration,seek);
