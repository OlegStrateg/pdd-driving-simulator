import {Exam} from './engine.js';
import {Renderer} from './render.js';
import {Renderer3D} from './render3d.js';
import {ROUTE} from './level.js';
import {kmh} from './car.js';
import {fetchPlace,pointInPolygon} from './places.js';
import {advanceCar} from './car.js';
import {reportHTML} from './report.js';
const $=id=>document.getElementById(id);
const exam=new Exam(),renderer2d=new Renderer($('world')),keys=new Set();
let renderer3d;
try{renderer3d=new Renderer3D($('world'));}
catch(e){
 document.getElementById('world3d')?.remove();
 renderer3d={unavailable:true,visible(){},buildCity(){},draw(exam,dt){renderer2d.draw(exam,dt);}};
 $('view-3d').disabled=true;$('choose-place').disabled=true;
 $('coach').textContent='3D недоступен: включите аппаратное ускорение браузера. Учебный маршрут доступен в 2D.';
}
const stored=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
let mode=stored('view-mode','3d'),last=performance.now(),seenFaults=0,noticeUntil=0,resultShown=false,lastStage=-1,learning=false,learningStep=0,learningKeys=new Set(),tutorialResume=false;
let place=null,pendingPlace=null,placeTime=0;
const driveKeys=new Set(['KeyW','ArrowUp','KeyS','ArrowDown','Space','KeyA','ArrowLeft','KeyD','ArrowRight','KeyR']);
const lessons=[
 {title:'Газ и тормоз',text:'Удерживайте W, чтобы разгоняться. Отпустите — автомобиль начнёт замедляться. S или Пробел тормозит до полной остановки. Нажмите W, затем S.',keys:[['KeyW','W'],['KeyS','S']]},
 {title:'Повороты и задний ход',text:'A — руль влево, D — вправо. Руль поворачивает автомобиль только в движении. R — задний ход; сначала остановитесь. Проверьте A, D и R.',keys:[['KeyA','A'],['KeyD','D'],['KeyR','R']]},
 {title:'Поворотники без загадок',text:'Q включает левый сигнал, E — правый. Повторное нажатие той же клавиши выключает его. X выключает любой сигнал. После законченного поворота он отключается автоматически. Проверьте Q, E и X.',keys:[['KeyQ','Q'],['KeyE','E'],['KeyX','X']]},
 {title:'Пауза, виды и правила',text:'Esc ставит поездку на паузу. V переключает 2D / 3D, C открывает карту. Красная карточка объясняет нарушение; все события сохраняются в журнале справа. ДТП завершает поездку. На переходе дождитесь пешехода. Проверьте V и Esc.',keys:[['KeyV','V'],['Escape','Esc']]}
];
ROUTE.forEach((p,i)=>{const li=document.createElement('li');const n=document.createElement('b');n.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=p.label;li.append(n,label);$('route').append(li);});
function setMode(value){if(renderer3d.unavailable)value='2d';else if(place)value='3d';mode=value;save('view-mode',mode);renderer2d.overview=false;$('view-2d').setAttribute('aria-pressed',mode==='2d');$('view-3d').setAttribute('aria-pressed',mode==='3d');$('camera').querySelector('span').textContent='Весь маршрут';}
setMode(mode);
function start(){
 $('place-credit').classList.add('hidden');$('scene-name').textContent='ЗЕЛЁНЫЙ КВАРТАЛ';
 $('view-2d').disabled=false;$('camera').disabled=false;document.querySelector('.limit').textContent='40';document.querySelector('.limit').setAttribute('aria-label','Ограничение скорости 40');
 if(place){place=null;renderer3d.buildCity();}
 exam.start($('scenario').value);renderer2d.overview=false;renderer3d.angle=exam.car.angle;keys.clear();seenFaults=0;resultShown=false;lastStage=-1;
 $('intro').classList.add('hidden');$('learning').classList.add('hidden');$('pause-panel').classList.add('hidden');
 if($('result').open)$('result').close();
 $('pause').disabled=false;$('finish').disabled=false;$('notice').classList.remove('show');$('live-faults').replaceChildren();$('journal-count').textContent='0';
 $('camera').querySelector('span').textContent='Весь маршрут';document.querySelector('.drive').classList.remove('fault-flash');document.activeElement?.blur();
}
function lessonView(){
 const item=lessons[learningStep];learningKeys.clear();$('learning-progress').textContent='ЗНАКОМСТВО С УПРАВЛЕНИЕМ · '+(learningStep+1)+' / '+lessons.length;
 $('learning-title').textContent=item.title;$('learning-text').textContent=item.text;$('learning-keys').replaceChildren();
 for(const [code,label] of item.keys){const k=document.createElement('kbd');k.dataset.code=code;k.textContent=label;$('learning-keys').append(k);}
 $('learning-next').disabled=true;$('learning-next').textContent=learningStep===lessons.length-1?'Начать поездку →':'Дальше →';
 $('learning-confirm').textContent='Нажмите указанные клавиши. Автомобиль пока стоит.';
}
function openLearning(resume=false){tutorialResume=resume;learning=true;learningStep=0;keys.clear();$('learning').classList.remove('hidden');$('intro').classList.add('hidden');$('pause-panel').classList.add('hidden');lessonView();}
function endLearning(){learning=false;save('learned-v2','yes');$('learning').classList.add('hidden');if(tutorialResume){exam.status='running';keys.clear();}else start();}
function pause(){
 if(learning)return;
 if(exam.status==='running'){exam.status='paused';keys.clear();$('pause-panel').classList.remove('hidden');}
 else if(exam.status==='paused'){exam.status='running';$('pause-panel').classList.add('hidden');}
}
function showResult(){
 if(resultShown)return;resultShown=true;keys.clear();
 const completed=exam.status==='finished',accident=exam.status==='accident';
 if(!completed&&!accident)exam.status='aborted';
 $('pause-panel').classList.add('hidden');
 $('result-title').textContent=accident?'ДТП — поездка остановлена':completed?(exam.faults.length?'Завершено с замечаниями':'Выполнено без замечаний'):'Поездка остановлена';
 $('result-summary').className=exam.faults.length?'result-bad':'result-good';
 $('result-summary').textContent=(accident?'После столкновения участники остановлены. Разберите причину и повторите упражнение. ':completed?'Задание завершено. ':'Задание пройдено не полностью. ')+Math.round(exam.time-exam.startedAt)+' сек. · Замечаний: '+exam.faults.length;
 $('fault-list').replaceChildren();
 if(!exam.faults.length){const p=document.createElement('p');p.textContent=completed?'Правильные действия: вы выполнили задание без зафиксированных нарушений.':'На пройденном участке замечаний нет.';$('fault-list').append(p);}
 for(const f of exam.faults){
  const item=document.createElement('div');item.className='fault';
  const title=document.createElement('strong');title.textContent=f.id+'. '+f.title;
  const time=document.createElement('small');time.textContent=f.time+' с · '+f.ref;
  const detail=document.createElement('p');detail.textContent='Что произошло: '+(f.detail||f.title);
  const advice=document.createElement('p');advice.textContent='Как правильно: '+f.advice;
  item.append(time,title,detail,advice);$('fault-list').append(item);
 }
 if(place){$('result-title').textContent='Знакомство с местностью завершено';$('result-summary').textContent=place.name+' · '+Math.round(exam.time)+' сек. Проверка ПДД для этого участка не включена.';$('fault-list').replaceChildren();}
 save('last-report-v2',JSON.stringify(exam.report()));$('pause').disabled=true;$('finish').disabled=true;$('result').showModal();
}
function camera(){if(place)return;renderer2d.overview=!renderer2d.overview;$('camera').querySelector('span').textContent=renderer2d.overview?'За автомобилем':'Весь маршрут';}
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('start').onclick=()=>stored('learned-v2','')==='yes'?start():openLearning();
$('restart').onclick=start;$('pause').onclick=pause;$('resume').onclick=pause;
$('finish').onclick=showResult;$('camera').onclick=camera;
$('view-2d').onclick=()=>setMode('2d');$('view-3d').onclick=()=>setMode('3d');
$('left-signal').onclick=()=>{if(exam.status==='running')exam.signal('left');};
$('right-signal').onclick=()=>{if(exam.status==='running')exam.signal('right');};
$('signal-off').onclick=()=>{if(exam.status==='running')exam.signal('off');};
$('help').onclick=()=>{if(exam.status==='running')pause();$('help-dialog').showModal();};
$('close-help').onclick=()=>$('help-dialog').close();
$('repeat-learning').onclick=()=>{$('help-dialog').close();openLearning(exam.status==='paused');};
$('learning-next').onclick=()=>{if(++learningStep>=lessons.length)endLearning();else lessonView();};
$('learning-skip').onclick=endLearning;
$('result').addEventListener('cancel',e=>e.preventDefault());
$('download').onclick=()=>download(reportHTML(exam.report()),'text/html;charset=utf-8','Протокол-поездки.html');
$('download-json').onclick=()=>download(JSON.stringify(exam.report(),null,2),'application/json','pdd-driving-report.json');
$('print-report').onclick=()=>window.print();
document.addEventListener('keydown',e=>{
 if(learning){
  e.preventDefault();learningKeys.add(e.code);const expected=lessons[learningStep].keys;
  for(const k of $('learning-keys').children)k.classList.toggle('pressed',learningKeys.has(k.dataset.code));
  if(expected.every(([code])=>learningKeys.has(code))){$('learning-next').disabled=false;$('learning-confirm').textContent='Клавиши проверены. Можно продолжать.';}return;
 }
 if($('help-dialog').open||$('result').open||$('places-dialog').open)return;
 if(driveKeys.has(e.code)){e.preventDefault();if(exam.status==='running')keys.add(e.code);}
 if(e.repeat)return;
 if(e.code==='Escape')pause();
 if(e.code==='KeyC')camera();
 if(e.code==='KeyV')setMode(mode==='3d'?'2d':'3d');
 if(exam.status==='running'&&e.code==='KeyQ')exam.signal('left');
 if(exam.status==='running'&&e.code==='KeyE')exam.signal('right');
 if(exam.status==='running'&&e.code==='KeyX')exam.signal('off');
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(exam.status==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&exam.status==='running')pause();});
function ui(){
 $('speed').textContent=Math.round(kmh(exam.car));$('gear').textContent=exam.car.speed>1?'D':exam.car.speed<-1?'R':'N';
 $('timer').textContent=String(Math.floor((exam.time-exam.startedAt)/60)).padStart(2,'0')+':'+String(Math.floor((exam.time-exam.startedAt)%60)).padStart(2,'0');
 $('fault-count').textContent=exam.faults.length;
 $('left-signal').setAttribute('aria-pressed',exam.car.signal==='left');$('right-signal').setAttribute('aria-pressed',exam.car.signal==='right');
 $('signal-state').textContent=exam.car.signal==='off'?'Поворотники выключены':exam.car.signal==='left'?'◀ Левый включён · Q повторно / X':'Правый включён ▶ · E повторно / X';
 document.querySelector('.signal-help').classList.toggle('active',exam.car.signal!=='off');
 $('hazard').classList.toggle('hidden',!exam.hazards.pedestrian||exam.status!=='running'||learning);
 if(lastStage!==exam.stage){
  lastStage=exam.stage;$('instruction').textContent=exam.scenario==='pedestrian'?'Уступите пешеходу. Дождитесь освобождения пути и проедьте переход.':exam.scenario==='priority'?'Уступите машине на главной дороге. Проедьте перекрёсток без ДТП.':ROUTE[exam.stage].hint;
  $('next-label').textContent=exam.scenario&&exam.scenario!=='route'?'КОРОТКАЯ ТРЕНИРОВКА':'ШАГ '+(exam.stage+1)+' / '+ROUTE.length+' · '+ROUTE[exam.stage].label.toUpperCase();
  const short=exam.scenario&&exam.scenario!=='route';$('progress-text').textContent=short?'Упражнение':exam.stage+' / '+ROUTE.length;$('progress').style.width=short?'0%':(exam.stage/ROUTE.length*100)+'%';$('route').classList.toggle('hidden',!!short);
  [...$('route').children].forEach((li,i)=>{li.className=i<exam.stage?'done':i===exam.stage?'current':'';li.querySelector('b').textContent=i<exam.stage?'✓':String(i+1).padStart(2,'0');});
 }
 if(exam.status==='finished'){$('progress').style.width='100%';$('progress-text').textContent='Выполнено';}
 if(exam.faults.length>seenFaults){
  for(const fault of exam.faults.slice(seenFaults)){
   const li=document.createElement('li');li.dataset.code=fault.code;
   const label=document.createElement('strong');label.textContent=fault.id+'. '+fault.title;
   const detail=document.createElement('small');detail.textContent=fault.time+' с · '+fault.ref;
   li.append(label,detail);li.title=fault.advice;$('live-faults').prepend(li);
  }
  const fault=exam.faults.at(-1);
  $('notice-title').textContent='⚠ '+fault.title;$('notice-detail').textContent=fault.advice;$('notice-rule').textContent=fault.ref+' · '+fault.time+' с · Сохранено в журнале';
  $('notice').classList.add('show');document.querySelector('.drive').classList.add('fault-flash');$('coach').textContent=fault.advice;noticeUntil=exam.time+6;seenFaults=exam.faults.length;$('journal-count').textContent=exam.faults.length;
 }
 if(exam.time>noticeUntil){$('notice').classList.remove('show');document.querySelector('.drive').classList.remove('fault-flash');}
 Object.assign($('telemetry').dataset,{x:exam.car.x,y:exam.car.y,angle:exam.car.angle,speed:exam.car.speed,time:exam.time,stage:exam.stage,status:exam.status,signal:exam.car.signal,stop:exam.stopDone,mode,learning,faults:exam.faults.map(f=>f.code).join(',')});
}

function tick(input,dt){
 if(!place){exam.tick(input,dt);return;}
 if(exam.status!=='running')return;
 exam.time+=dt;const c=exam.car,old={...c};advanceCar(c,input,dt);
 const hit=place.buildings.some(b=>pointInPolygon(c.x/10,c.y/10,b.points));
 if(hit){c.x=old.x;c.y=old.y;c.speed=0;$('coach').textContent='Здание: движение остановлено. Отъедьте назад.';}
 if(Math.abs(c.x)>4000||Math.abs(c.y)>4000){c.x=old.x;c.y=old.y;c.speed=0;$('coach').textContent='Граница загруженного участка';}
 $('instruction').textContent=place.name+' · свободная поездка без оценки ПДД';
 $('next-label').textContent='РЕАЛЬНЫЕ УЛИЦЫ · УСЛОВНЫЕ ФАСАДЫ';
}
function previewPlace(p){
 pendingPlace=p;const cv=$('place-preview'),ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);const scale=.34;
 const xy=q=>[cv.width/2+q.x*scale,cv.height/2+q.y*scale];
 ctx.fillStyle='#b3b5a5';for(const b of p.buildings){ctx.beginPath();b.points.forEach((v,i)=>i?ctx.lineTo(...xy(v)):ctx.moveTo(...xy(v)));ctx.closePath();ctx.fill();}
 ctx.strokeStyle='#52616c';ctx.lineCap='round';
 for(const r of p.roads){ctx.lineWidth=Math.max(2,r.width*scale);ctx.beginPath();r.points.forEach((v,i)=>i?ctx.lineTo(...xy(v)):ctx.moveTo(...xy(v)));ctx.stroke();}
 const [x,y]=xy(p.spawn);ctx.fillStyle='#bf3b2e';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();
 $('drive-place').disabled=false;$('place-status').textContent=p.name+': '+p.roads.length+' улиц, '+p.buildings.length+' зданий. Красная точка — старт.';
}
$('place-preset').onchange=()=>{const option=$('place-preset').selectedOptions[0];if(!option.value)return;const [lat,lon]=option.value.split(',');$('place-lat').value=lat;$('place-lon').value=lon;$('place-name').value=option.textContent;};
$('choose-place').onclick=()=>$('places-dialog').showModal();
$('close-places').onclick=()=>$('places-dialog').close();
$('saved-place').onclick=()=>{try{const p=JSON.parse(stored('saved-place-v1','null'));if(!p)throw Error('Сначала загрузите участок');previewPlace(p);}catch(e){$('place-status').textContent=e.message;}};
$('load-place').onclick=async()=>{
 $('load-place').disabled=true;$('drive-place').disabled=true;$('place-status').textContent='Загружаем улицы…';
 try{
  const a=$('place-lat').value,b=$('place-lon').value;if(!a.trim()||!b.trim())throw Error('Введите обе координаты');
  const p=await fetchPlace(Number(a),Number(b),$('place-name').value);
  previewPlace(p);try{localStorage.setItem('saved-place-v1',JSON.stringify(p));}catch{$('place-status').textContent+=' Не удалось сохранить: хранилище заполнено.';}
 }catch(e){$('place-status').textContent='Не удалось загрузить: '+e.message;}
 finally{$('load-place').disabled=false;}
};
$('drive-place').onclick=()=>{
 if(!pendingPlace)return;
 start();place=pendingPlace;$('place-credit').classList.remove('hidden');$('scene-name').textContent=place.name;exam.scenario='free';exam.started=true;exam.time=0;exam.startedAt=0;
 Object.assign(exam.car,{x:place.spawn.x*10,y:place.spawn.y*10,angle:place.spawn.angle,speed:0});
 $('view-2d').disabled=true;$('camera').disabled=true;document.querySelector('.limit').textContent='—';document.querySelector('.limit').setAttribute('aria-label','Ограничение по карте не проверено');
 renderer3d.buildCity(place);renderer3d.angle=exam.car.angle;setMode('3d');
 $('places-dialog').close();$('intro').classList.add('hidden');$('route').classList.add('hidden');
 $('coach').textContent='Здесь можно познакомиться с геометрией улиц. Правила и знаки для этого участка не проверены.';
};
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(!learning)tick({gas:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown')||keys.has('Space'),reverse:keys.has('KeyR'),left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight')},dt);
 if(mode==='3d'&&!renderer2d.overview)renderer3d.draw(exam,dt);else{renderer3d.visible(false);renderer2d.draw(exam,dt);$('world').dataset.rendered='2d';}
 ui();if(exam.status==='finished'||exam.status==='accident')showResult();
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
