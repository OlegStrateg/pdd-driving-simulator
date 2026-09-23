
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {driver} from './driver.mjs';
await mkdir('artifacts',{recursive:true});
const extension=path.resolve('dist/extension');
const googleChrome=process.env.TEST_BROWSER==='chrome';
let extensionId=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const context=await chromium.launchPersistentContext(path.resolve('artifacts/browser-profile'),{
 channel:googleChrome?'chrome':'chromium',headless:true,viewport:{width:1440,height:1000},
 ignoreDefaultArgs:googleChrome?['--disable-extensions']:[],
 args:[ '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(googleChrome?['--enable-unsafe-extension-debugging']:['--disable-extensions-except='+extension,'--load-extension='+extension])]
});
if(googleChrome){
 const cdp=await context.browser().newBrowserCDPSession();
 const loaded=await cdp.send('Extensions.loadUnpacked',{path:extension});extensionId=loaded.id;
 await cdp.detach();
}
context.setDefaultTimeout(60000);
const errors=[],requests=[];
context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>console.log('REQUEST_FAILED',r.url(),JSON.stringify(r.failure())));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});});
let page;
try{
 await context.setOffline(true);
 const popup=await context.newPage();
 await popup.goto('chrome-extension://'+extensionId+'/popup.html');
 const newPage=context.waitForEvent('page');
 await popup.getByRole('button',{name:'Открыть симулятор'}).click();
 page=await newPage;await page.waitForLoadState();await page.bringToFront();
 assert.ok(page.url().endsWith('/index.html'));
 await page.locator('#world3d[data-ready="true"]').waitFor({timeout:90000});
 await page.waitForTimeout(2000);
 const graphics=await page.locator('#world3d').evaluate(el=>({...el.dataset}));console.log('GRAPHICS',JSON.stringify(graphics));
 await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});
 await page.clock.pauseAt(new Date('2030-01-02T00:00:00Z'));
 await page.reload();await page.locator('#world3d[data-ready="true"]').waitFor({timeout:90000});
 await page.clock.runFor(1000);
 await page.screenshot({path:'artifacts/01-start.png'});
 await page.locator('#start').click();
 assert.ok(await page.locator('#learning').isVisible());
 const tutorialStart=await page.locator('#telemetry').evaluate(el=>({...el.dataset}));
 for(const group of [['KeyW','KeyS'],['KeyA','KeyD','KeyR'],['KeyQ','KeyE','KeyX'],['KeyV','Escape']]){
  assert.ok(await page.locator('#learning-next').isDisabled());
  for(const key of group)await page.keyboard.press(key);
  await page.locator('#learning-next').click();
 }
 await page.clock.runFor(50);
 assert.equal(+(await page.locator('#telemetry').getAttribute('data-x')),530,'Onboarding must not move vehicle');
 await page.keyboard.press('KeyQ');await page.clock.runFor(50);assert.equal(await page.locator('#telemetry').getAttribute('data-signal'),'left');
 await page.locator('#signal-off').click();await page.clock.runFor(50);assert.equal(await page.locator('#telemetry').getAttribute('data-signal'),'off');
 await page.keyboard.press('KeyE');await page.keyboard.press('KeyX');await page.clock.runFor(50);assert.equal(await page.locator('#telemetry').getAttribute('data-signal'),'off');
 assert.equal(await page.locator('#world').getAttribute('data-rendered'),'3d');
 const viewPosition=await page.locator('#telemetry').getAttribute('data-x');
 await page.locator('#view-2d').click();await page.clock.runFor(100);assert.equal(await page.locator('#world').getAttribute('data-rendered'),'2d');
 await page.locator('#view-3d').click();await page.clock.runFor(100);assert.equal(await page.locator('#world').getAttribute('data-rendered'),'3d');assert.equal(await page.locator('#telemetry').getAttribute('data-x'),viewPosition);
 await page.screenshot({path:'artifacts/01b-3d.png'});
 const preview3d=await page.screenshot({type:'jpeg',quality:75});console.log('THREE_D_BASE64:'+preview3d.toString('base64'));
 await page.locator('#view-2d').click();await page.clock.runFor(50);
 await page.keyboard.down('KeyW');await page.clock.runFor(2500);await page.keyboard.up('KeyW');
 const state=()=>page.locator('#telemetry').evaluate(el=>({...el.dataset}));
 let s=await state();assert.ok(+s.x>600);assert.ok(s.faults.includes('speed')&&s.faults.includes('signal'));
 await page.screenshot({path:'artifacts/02-driving-and-fault.png'});
 await page.keyboard.press('Escape');s=await state();
 await page.clock.runFor(100);s=await state();const pausedX=+s.x;
 await page.clock.runFor(1000);assert.equal(+(await state()).x,pausedX);
 await page.locator('#resume').click();await page.locator('#finish').click();
 assert.ok(await page.locator('#result').isVisible());
 await page.locator('#restart').click();await page.clock.runFor(100);
 assert.equal((await state()).faults,'');
 await page.keyboard.press('KeyQ');await page.clock.runFor(800);
 const memory={},held=new Set();
 for(let i=0;i<2000;i++){
  s=await state();if(s.status==='finished')break;
  assert.equal(s.status,'running','Unexpected simulation status');
  const d=driver(s,memory);
  if(s.signal!==d.signal)await page.keyboard.press(d.signal==='left'?'KeyQ':'KeyE');
  const desired=new Set(Object.entries({KeyW:d.input.gas,Space:d.input.brake,KeyA:d.input.left,KeyD:d.input.right}).filter(([,v])=>v).map(([k])=>k));
  for(const key of held)if(!desired.has(key)){await page.keyboard.up(key);held.delete(key);}
  for(const key of desired)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}
  await page.clock.runFor(100);
  if(i===400)await page.screenshot({path:'artifacts/03-city-route.png'});
  if(i%300===0)console.log('DRIVE',i,JSON.stringify({x:s.x,y:s.y,stage:s.stage,index:memory.index}));
 }
 for(const k of ['KeyW','Space','KeyA','KeyD'])await page.keyboard.up(k);
 s=await state();
 assert.equal(s.status,'finished','Route must finish using keyboard input, without teleporting');
 assert.ok(await page.locator('#result').isVisible());
 await page.screenshot({path:'artifacts/04-protocol.png'});
 const downloadEvent=page.waitForEvent('download');await page.locator('#download-json').click();
 const download=await downloadEvent;await download.saveAs('artifacts/protocol.json');
 const report=JSON.parse(await readFile('artifacts/protocol.json','utf8'));
 assert.equal(report.completed,true);assert.ok(report.trace.length>50);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.length,0,'Extension must work offline without HTTP requests');

 // Human-readable report is the primary download, and must open as a real document.
 const htmlEvent=page.waitForEvent('download');await page.locator('#download').click();const htmlDownload=await htmlEvent;
 assert.ok(htmlDownload.suggestedFilename().endsWith('.html'));await htmlDownload.saveAs('artifacts/report.html');
 const html=await readFile('artifacts/report.html','utf8');assert.ok(html.includes('Что произошло:')&&html.includes('Как правильно:'));
 // Exercise paths are selected by the same UI a learner uses; never mutate engine state.
 async function exercise(name){
  await page.reload();await page.clock.runFor(100);await page.locator('#scenario').selectOption(name);
  await page.locator('#start').click();await page.clock.runFor(100);
 }
 await exercise('pedestrian');
 await page.keyboard.down('KeyW');await page.clock.runFor(3600);await page.keyboard.up('KeyW');
 let bad=await state();assert.ok(bad.faults.includes('pedestrian'),'Failure to yield must be recorded in real UI');
 assert.ok(await page.locator('#live-faults li[data-code="pedestrian"]').count()>0);
 await page.screenshot({path:'artifacts/06-pedestrian-violation.png'});
 if(bad.status==='running')await page.locator('#finish').click();
 assert.ok((await page.locator('#fault-list').innerText()).includes('Не уступили пешеходу'));
 await exercise('pedestrian');await page.clock.runFor(7000);
 for(let i=0;i<150;i++){
  const s=await state();if(s.status==='finished')break;
  if(+s.speed<34){await page.keyboard.up('Space');await page.keyboard.down('KeyW');}
  else {await page.keyboard.up('KeyW');if(+s.speed>36)await page.keyboard.down('Space');}
  await page.clock.runFor(100);
 }
 await page.keyboard.up('KeyW');await page.keyboard.up('Space');
 const good=await state();assert.equal(good.status,'finished');assert.equal(good.faults,'','Waiting then crossing safely must not produce faults');
 await page.screenshot({path:'artifacts/07-pedestrian-correct.png'});
 await exercise('priority');await page.keyboard.down('KeyW');await page.clock.runFor(5000);await page.keyboard.up('KeyW');
 const crash=await state();assert.equal(crash.status,'accident');assert.ok(crash.faults.includes('collision'));
 const frozen=crash.x;await page.clock.runFor(1000);assert.equal((await state()).x,frozen);
 assert.ok((await page.locator('#result-title').innerText()).includes('ДТП'));
 await page.screenshot({path:'artifacts/08-accident.png'});
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.length,0);
 const summary={browser:googleChrome?'Google Chrome with CDP Load unpacked':'Playwright Chromium with unpacked extension',extensionId,offline:true,onboarding:true,views2d3d:true,readableReport:true,pedestrianBadAndGood:true,crashStopsScene:true,signalOff:true,routeCompleted:true,keyboardOnly:true,seconds:report.duration,faultCount:report.faults.length,consoleErrors:errors,httpRequests:requests,manualGoogleChromeLoadUnpacked:'NOT TESTED'};
 await writeFile('artifacts/browser-summary.json',JSON.stringify(summary,null,2));
 console.log('BROWSER PASS',JSON.stringify(summary));
 // A compact JPEG in the log enables visual review without publishing a website.
 await page.locator('#restart').click();await page.clock.runFor(1000);
 await page.keyboard.press('KeyC');await page.clock.runFor(1000);
 const preview=await page.screenshot({type:'jpeg',quality:65,path:'artifacts/05-map.jpg'});
 console.log('VISUAL_REVIEW_BASE64:'+preview.toString('base64'));

}catch(error){
 console.log('ERRORS',JSON.stringify(errors));
 if(page){const shot=await page.screenshot({type:'jpeg',quality:65}).catch(()=>null);if(shot)console.log('FAILURE_BASE64:'+shot.toString('base64'));await page.screenshot({path:'artifacts/failure.png'}).catch(()=>{});console.log('FAIL_STATE',await page.locator('#telemetry').evaluate(el=>({...el.dataset})).catch(()=>({})));}
 throw error;
}finally{await context.close();}
