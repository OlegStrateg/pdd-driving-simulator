
import test from 'node:test';
import assert from 'node:assert/strict';
import {Exam} from '../extension/engine.js';
import {advanceCar,createCar} from '../extension/car.js';
import {lightAt,ROUTE} from '../extension/level.js';
const run=(e,input={},seconds=1)=>{for(let i=0;i<seconds*60;i++)e.tick(input,1/60);};
const moving=(x,y,angle,speed=40)=>{const e=new Exam();e.start();e.started=true;Object.assign(e.car,{x,y,angle,speed});return e;};
test('throttle, brake, reverse and steering change vehicle state',()=>{
 const c=createCar();for(let i=0;i<120;i++)advanceCar(c,{gas:true},1/60);
 assert.ok(c.x>580&&c.speed>60);
 for(let i=0;i<60;i++)advanceCar(c,{brake:true},1/60);
 assert.equal(c.speed,0);for(let i=0;i<60;i++)advanceCar(c,{reverse:true,right:true},1/60);
 assert.ok(c.speed<0&&c.angle<0);
});
test('STOP crossing without standstill is recorded',()=>{
 const e=moving(1476,1160,0);run(e,{gas:true},.2);assert.ok(e.faults.some(f=>f.code==='stop'));
});
test('complete stop before line permits crossing',()=>{
 const e=moving(1477,1160,0,0);run(e,{},.3);assert.equal(e.stopDone,true);
 run(e,{gas:true},1);assert.equal(e.faults.filter(f=>f.code==='stop').length,0);
});
test('stopping far from STOP does not satisfy the sign',()=>{
 const e=moving(1400,1160,0,0);run(e,{},1);e.car.x=1476;e.car.speed=40;run(e,{gas:true},.2);
 assert.ok(e.faults.some(f=>f.code==='stop'));
});
test('red crossing fails, green crossing passes',()=>{
 for(const [time,expected] of [[0,true],[10,false]]){
  const e=moving(1640,823,-Math.PI/2);e.time=time;run(e,{gas:true},.15);
  assert.equal(e.faults.some(f=>f.code==='light'),expected);
 }
 assert.equal(lightAt(17),'yellow');
});
test('speed episode is recorded once, then re-arms',()=>{
 const e=moving(950,1160,0,60);run(e,{gas:true},.5);assert.equal(e.faults.filter(f=>f.code==='speed').length,1);
 run(e,{brake:true},1);e.car.speed=60;run(e,{},.1);assert.equal(e.faults.filter(f=>f.code==='speed').length,2);
});
test('pedestrian conflict depends on moving pedestrian position',()=>{
 const e=moving(775,1160,0);e.time=7;run(e,{},.2);assert.ok(e.faults.some(f=>f.code==='pedestrian'));
 const safe=moving(775,1160,0);safe.time=12;run(safe,{},.2);assert.ok(!safe.faults.some(f=>f.code==='pedestrian'));
});
test('yield compares cross traffic arrival, not a mandatory stop',()=>{
 for(const [time,bad] of [[2,true],[12,false]]){
  const e=moving(1318,360,Math.PI);e.time=time;run(e,{},.15);
  assert.equal(e.faults.some(f=>f.code==='yield'),bad);
 }
});
test('no-right-turn, solid-line, start signal and collision rules',()=>{
 const e=moving(1640,1214,Math.PI/2);run(e,{},.2);assert.ok(e.faults.some(f=>f.code==='turn'));
 const line=moving(900,1119,Math.PI/2);run(line,{},.2);assert.ok(line.faults.some(f=>f.code==='line'));
 const start=new Exam();start.start();run(start,{gas:true},.2);assert.ok(start.faults.some(f=>f.code==='signal'));
 const hit=moving(505,580,0);run(hit,{gas:true},.5);assert.ok(hit.faults.some(f=>f.code==='collision'));
});
test('signal is required before turning; last-moment signal is insufficient',()=>{
 for(const [advance,bad] of [[1,false],[0,true]]){
  const e=moving(1450,1160,0);e.car.signal='left';e.car.signalSince=-advance;
  run(e,{gas:true,left:true},.8);assert.equal(e.faults.some(f=>f.code==='signal'),bad);
 }
});
test('checkpoints cannot be skipped by parking at the start',()=>{
 const e=moving(940,1248,0,0);run(e,{},3);assert.notEqual(e.status,'finished');
 e.stage=ROUTE.length-1;run(e,{},2.2);assert.equal(e.status,'finished');
 assert.equal(e.report().completed,true);
});
test('parking requires entire vehicle in bay, alignment, standstill and duration',()=>{
 const e=moving(841,1248,0,0);e.stage=ROUTE.length-1;run(e,{},3);assert.notEqual(e.status,'finished');
 e.car.x=940;e.car.angle=Math.PI/2;run(e,{},3);assert.notEqual(e.status,'finished');
 e.car.angle=0;run(e,{},1);assert.notEqual(e.status,'finished');run(e,{},1.2);assert.equal(e.status,'finished');
});
test('pause freezes simulation and restart clears evidence',()=>{
 const e=moving(900,1160,0);e.status='paused';run(e,{gas:true},1);assert.equal(e.time,0);assert.equal(e.car.x,900);
 e.add('speed');e.start();assert.equal(e.faults.length,0);assert.equal(e.stage,0);
});
