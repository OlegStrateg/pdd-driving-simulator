
import {Exam} from './engine.js';
import {Renderer} from './render.js';
import {ROUTE,RULES} from './level.js';
import {kmh} from './car.js';
const $=id=>document.getElementById(id);
const exam=new Exam(),renderer=new Renderer($('world')),keys=new Set();
const driveKeys=new Set(['KeyW','ArrowUp','KeyS','ArrowDown','Space','KeyA','ArrowLeft','KeyD','ArrowRight','KeyR']);
let last=performance.now(),seenFaults=0,noticeUntil=0,resultShown=false,lastStage=-1;
ROUTE.forEach((p,i)=>{const li=document.createElement('li');const n=document.createElement('b');n.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=p.label;li.append(n,label);$('route').append(li);});
function start(){exam.start();renderer.overview=false;keys.clear();seenFaults=0;resultShown=false;lastStage=-1;$('intro').classList.add('hidden');$('pause-panel').classList.add('hidden');if($('result').open)$('result').close();$('pause').disabled=false;$('finish').disabled=false;$('notice').classList.remove('show');document.activeElement?.blur();}
function pause(){
 if(exam.status==='running'){exam.status='paused';keys.clear();$('pause-panel').classList.remove('hidden');}
 else if(exam.status==='paused'){exam.status='running';$('pause-panel').classList.add('hidden');}
}
function showResult(){
 if(resultShown)return;resultShown=true;keys.clear();
 const completed=exam.status==='finished';
 if(!completed)exam.status='aborted';
 $('pause-panel').classList.add('hidden');
 $('result-title').textContent=completed?'Маршрут завершён':'Поездка остановлена';
 $('result-summary').textContent=(completed?'Вы прошли городской маршрут. ':'Маршрут пройден не полностью. ')+Math.round(exam.time)+' сек. · Замечаний: '+exam.faults.length;
 $('fault-list').replaceChildren();
 if(!exam.faults.length){const p=document.createElement('p');p.textContent=completed?'Аккуратная поездка: замечаний нет.':'На пройденном участке замечаний нет.';$('fault-list').append(p);}
 for(const f of exam.faults){
  const item=document.createElement('div');item.className='fault';
  const title=document.createElement('strong');title.textContent=f.title;
  const time=document.createElement('small');time.textContent=f.time+' с · '+f.ref;
  const advice=document.createElement('p');advice.textContent=f.advice+(f.detail?' '+f.detail:'');
  item.append(time,title,advice);$('fault-list').append(item);
 }
 $('pause').disabled=true;$('finish').disabled=true;$('result').showModal();
}
function camera(){renderer.overview=!renderer.overview;$('camera').querySelector('span').textContent=renderer.overview?'За автомобилем':'Весь маршрут';}
$('start').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('resume').onclick=pause;
$('finish').onclick=showResult;$('camera').onclick=camera;
$('left-signal').onclick=()=>{if(exam.status==='running')exam.signal('left');};
$('right-signal').onclick=()=>{if(exam.status==='running')exam.signal('right');};
$('help').onclick=()=>{if(exam.status==='running')pause();$('help-dialog').showModal();};
$('close-help').onclick=()=>$('help-dialog').close();
$('result').addEventListener('cancel',e=>e.preventDefault());
$('download').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(exam.report(),null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='pdd-driving-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('keydown',e=>{
 if($('help-dialog').open||$('result').open)return;
 if(driveKeys.has(e.code)){e.preventDefault();if(exam.status==='running')keys.add(e.code);}
 if(e.repeat)return;
 if(e.code==='Escape')pause();
 if(e.code==='KeyC')camera();
 if(exam.status==='running'&&e.code==='KeyQ')exam.signal('left');
 if(exam.status==='running'&&e.code==='KeyE')exam.signal('right');
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(exam.status==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&exam.status==='running')pause();});
function ui(){
 $('speed').textContent=Math.round(kmh(exam.car));$('gear').textContent=exam.car.speed>1?'D':exam.car.speed<-1?'R':'N';
 $('timer').textContent=String(Math.floor(exam.time/60)).padStart(2,'0')+':'+String(Math.floor(exam.time%60)).padStart(2,'0');
 $('fault-count').textContent=exam.faults.length;
 $('left-signal').setAttribute('aria-pressed',exam.car.signal==='left');$('right-signal').setAttribute('aria-pressed',exam.car.signal==='right');
 if(lastStage!==exam.stage){
  lastStage=exam.stage;$('instruction').textContent=ROUTE[exam.stage].hint;
  $('next-label').textContent='ШАГ '+(exam.stage+1)+' / '+ROUTE.length+' · '+ROUTE[exam.stage].label.toUpperCase();
  $('progress-text').textContent=exam.stage+' / '+ROUTE.length;$('progress').style.width=(exam.stage/ROUTE.length*100)+'%';
  [...$('route').children].forEach((li,i)=>{li.className=i<exam.stage?'done':i===exam.stage?'current':'';li.querySelector('b').textContent=i<exam.stage?'✓':String(i+1).padStart(2,'0');});
 }
 if(exam.status==='finished'){$('progress').style.width='100%';$('progress-text').textContent=ROUTE.length+' / '+ROUTE.length;}
 if(exam.faults.length>seenFaults){const f=exam.faults.at(-1);$('notice').textContent=f.title;$('notice').classList.add('show');$('coach').textContent=f.advice;noticeUntil=exam.time+4;seenFaults=exam.faults.length;}
 if(exam.time>noticeUntil)$('notice').classList.remove('show');
 // Read-only DOM telemetry for reproducible browser tests; no state mutation API.
 Object.assign($('telemetry').dataset,{x:exam.car.x,y:exam.car.y,angle:exam.car.angle,speed:exam.car.speed,time:exam.time,stage:exam.stage,status:exam.status,signal:exam.car.signal,stop:exam.stopDone,faults:exam.faults.map(f=>f.code).join(',')});
}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 exam.tick({gas:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown')||keys.has('Space'),reverse:keys.has('KeyR'),left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight')},dt);
 renderer.draw(exam,dt);ui();
 if(exam.status==='finished')showResult();
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
