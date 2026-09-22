import test from 'node:test';
import assert from 'node:assert/strict';
import {clipNear,cameraPoint} from '../extension/render3d.js';
import {reportHTML} from '../extension/report.js';
test('3D near clipping returns finite vertices at the near plane',()=>{
 const clipped=clipNear([[-1,0,2],[1,0,20],[1,1,20],[-1,1,2]]);
 assert.equal(clipped.length,4);assert.ok(clipped.every(p=>p[2]>=6&&p.every(Number.isFinite)));
 assert.equal(clipNear([[0,0,-10],[1,0,-1],[0,1,0]]).length,0);
});
test('camera basis preserves ahead and right directions',()=>{
 const c={x:0,y:0,z:0,right:[0,1,0],up:[0,0,1],forward:[1,0,0]};
 assert.deepEqual(cameraPoint([100,20,5],c),[20,5,100]);
});
test('human report explains each violation and escapes text as data',()=>{
 const html=reportHTML({version:'0.2.0',scenario:'pedestrian',completed:true,duration:20,faults:[{time:3,title:'<script>alert(1)</script>',ref:'ПДД 14.1',detail:'Не уступили',advice:'Остановитесь'}]});
 assert.ok(html.includes('Что произошло:')&&html.includes('Как правильно:'));
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
