import {chromium} from 'playwright';
import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const extension=path.resolve('dist/extension'),chrome=process.env.TEST_BROWSER==='chrome';
let id=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const context=await chromium.launchPersistentContext(path.resolve('artifacts/map-profile'),{headless:true,channel:chrome?'chrome':'chromium',viewport:{width:1280,height:800},ignoreDefaultArgs:chrome?['--disable-extensions']:[],args:['--use-angle=swiftshader','--enable-unsafe-swiftshader',...(chrome?['--enable-unsafe-extension-debugging']:['--disable-extensions-except='+extension,'--load-extension='+extension])]});
context.setDefaultTimeout(60000);
if(chrome){const cdp=await context.browser().newBrowserCDPSession();id=(await cdp.send('Extensions.loadUnpacked',{path:extension})).id;await cdp.detach();}
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>console.log('REQUEST_FAILED',r.url(),r.failure()));
try{
 await context.setOffline(true);await page.goto('chrome-extension://'+id+'/index.html');
 await page.locator('#world3d[data-ready="true"]').waitFor();
 await page.locator('#choose-place').click();await page.locator('#load-built-place').click();
 await page.locator('#drive-place:not([disabled])').waitFor();
 assert.ok((await page.locator('#place-status').innerText()).includes('Москва-Сити'));
 await page.screenshot({path:'artifacts/09a-moscow-preview.png'});
 await page.locator('#drive-place').click();
 await page.waitForTimeout(400);
 const before=await page.locator('#telemetry').evaluate(e=>({...e.dataset}));
 await page.keyboard.down('KeyW');
 try{await page.waitForFunction(({x,y})=>{const s=document.getElementById('telemetry').dataset;return Math.hypot(+s.x-x,+s.y-y)>.05;},{x:+before.x,y:+before.y},{timeout:30000,polling:100});}
 finally{await page.keyboard.up('KeyW');}

 await page.keyboard.press('Escape');
 const after=await page.locator('#telemetry').evaluate(e=>({...e.dataset}));
 assert.ok(Math.hypot(+after.x-before.x,+after.y-before.y)>0,'Vehicle must move through keyboard input');
 await page.screenshot({path:'artifacts/09-moscow-city.png'});
 console.log('MOSCOW_OFFLINE_PASS',JSON.stringify({before,after}));
 await page.reload();await context.setOffline(false);
 await page.locator('#choose-place').click();
 await page.locator('#place-name').fill('Москва-Сити · соседний участок');
 await page.locator('#place-lat').fill('55.7510');await page.locator('#place-lon').fill('37.5390');
 await page.locator('#load-place').click();await page.locator('#load-place:not([disabled])').waitFor();
 const message=await page.locator('#place-status').innerText();console.log('PLACE_STATUS',message);
 const customAreaOnline=!(await page.locator('#drive-place').isDisabled());
 if(!customAreaOnline)assert.ok(message.includes('Не удалось загрузить'),'A failed service must explain the error');
 await context.setOffline(true);await page.reload();
 await page.locator('#choose-place').click();await page.locator('#saved-place').click();await page.locator('#drive-place:not([disabled])').waitFor();
 await page.locator('#drive-place').click();await page.waitForTimeout(300);
 assert.equal(await page.locator('#telemetry').getAttribute('data-status'),'running');
 assert.equal(errors.length,0,errors.join('\n'));
 const summary={bundledMoscowOffline:true,keyboardDriving:true,customAreaOnline,savedAreaOffline:true,errors};
 await writeFile('artifacts/map-summary.json',JSON.stringify(summary,null,2));console.log('MAP PASS',JSON.stringify(summary));
}catch(e){console.log('MAP_ERRORS',errors,await page.locator('#telemetry').evaluate(e=>({...e.dataset})));const shot=await page.screenshot({type:'jpeg',quality:65}).catch(()=>null);if(shot)console.log('MAP_FAILURE_BASE64:'+shot.toString('base64'));throw e;}finally{await context.close();}
