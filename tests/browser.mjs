
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
 args:googleChrome?['--enable-unsafe-extension-debugging']:['--disable-extensions-except='+extension,'--load-extension='+extension]
});
if(googleChrome){
 const cdp=await context.newCDPSession(context.pages()[0]);
 const loaded=await cdp.send('Extensions.loadUnpacked',{path:extension});extensionId=loaded.id;
 await cdp.detach();
}
const errors=[],requests=[];
context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});});
let page;
try{
 await context.setOffline(true);
 const popup=await context.newPage();
 await popup.goto('chrome-extension://'+extensionId+'/popup.html');
 const newPage=context.waitForEvent('page');
 await popup.getByRole('button',{name:'Открыть симулятор'}).click();
 page=await newPage;await page.waitForLoadState();await page.bringToFront();
 assert.ok(page.url().endsWith('/index.html'));
 await page.clock.install();await page.reload();
 await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.clock.runFor(1000);
 await page.screenshot({path:'artifacts/01-start.png'});
 await page.locator('#start').click();
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
 const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();
 const download=await downloadEvent;await download.saveAs('artifacts/protocol.json');
 const report=JSON.parse(await readFile('artifacts/protocol.json','utf8'));
 assert.equal(report.completed,true);assert.ok(report.trace.length>50);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.length,0,'Extension must work offline without HTTP requests');
 const summary={browser:googleChrome?'Google Chrome with CDP Load unpacked':'Playwright Chromium with unpacked extension',extensionId,offline:true,routeCompleted:true,keyboardOnly:true,seconds:report.duration,faultCount:report.faults.length,consoleErrors:errors,httpRequests:requests,manualGoogleChromeLoadUnpacked:'NOT TESTED'};
 await writeFile('artifacts/browser-summary.json',JSON.stringify(summary,null,2));
 console.log('BROWSER PASS',JSON.stringify(summary));
 // A compact JPEG in the log enables visual review without publishing a website.
 await page.locator('#restart').click();await page.clock.runFor(1000);
 await page.keyboard.press('KeyC');await page.clock.runFor(1000);
 const preview=await page.screenshot({type:'jpeg',quality:65,path:'artifacts/05-map.jpg'});
 console.log('VISUAL_REVIEW_BASE64:'+preview.toString('base64'));
}catch(error){
 if(page){await page.screenshot({path:'artifacts/failure.png'}).catch(()=>{});console.log('FAIL_STATE',await page.locator('#telemetry').evaluate(el=>({...el.dataset})).catch(()=>({})));}
 throw error;
}finally{await context.close();}
