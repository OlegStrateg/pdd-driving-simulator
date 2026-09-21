
import {createCar,advanceCar,corners,kmh,norm} from './car.js';
import {ROUTE,RULES,SOLIDS,PARK,contains,onRoad,lightAt,trafficAt,pedestrianAt} from './level.js';
export class Exam {
 constructor(){this.reset();}
 reset(){
  this.car=createCar(); this.time=0;this.status='ready';this.stage=0;this.faults=[];this.active=new Set();
  this.stopDone=false;this.stopHold=0;this.parkHold=0;this.started=false;
  this.maneuver=null;this.lastTurnTime=-10;this.trace=[];this.recordAt=0;
 }
 start(){this.reset();this.status='running';}
 signal(value){this.car.signal=this.car.signal===value?'off':value;this.car.signalSince=this.time;}
 add(code,detail=''){
  this.faults.push({code,...RULES[code],detail,time:Math.round(this.time*10)/10,x:Math.round(this.car.x),y:Math.round(this.car.y)});
 }
 condition(code,bad,detail=''){
  if(bad&&!this.active.has(code)){this.add(code,detail);this.active.add(code);}
  if(!bad)this.active.delete(code);
 }
 signalValid(side){return this.car.signal===side&&this.time-this.car.signalSince>=.6;}
 tick(input,dt){
  if(this.status!=='running')return;
  dt=Math.min(dt,.05);this.time+=dt;
  const c=this.car,prev={...c};
  advanceCar(c,input,dt);
  if(!this.started&&Math.abs(c.speed)>2){
   this.started=true;if(!this.signalValid('left'))this.add('signal','Начало движения от правого края дороги');
  }
  const nose=c.x+Math.cos(c.angle)*22,oldNose=prev.x+Math.cos(prev.angle)*22;
  if(nose>=1465&&nose<=1500&&Math.abs(c.y-1160)<32&&Math.abs(c.angle)<.35&&Math.abs(c.speed)<.12){
   this.stopHold+=dt;if(this.stopHold>=.12)this.stopDone=true;
  } else this.stopHold=0;
  if(oldNose<1500&&nose>=1500&&c.y>1120&&c.y<1200&&Math.abs(c.angle)<.6&&!this.stopDone)this.add('stop');
  if(c.x<1420)this.stopDone=false;
  const frontY=c.y+Math.sin(c.angle)*22,oldFrontY=prev.y+Math.sin(prev.angle)*22;
  if(oldFrontY>800&&frontY<=800&&c.x>1600&&c.x<1680&&lightAt(this.time)!=='green')this.add('light');
  const pedestrian=pedestrianAt(this.time);
  this.condition('pedestrian',pedestrian.active&&Math.abs(c.x-800)<42&&Math.abs(pedestrian.y-c.y)<60&&Math.abs(c.speed)>2);
  const traffic=trafficAt(this.time);
  const westNose=c.x-22,oldWestNose=prev.x-22;
  if(oldWestNose>1295&&westNose<=1295&&c.y>320&&c.y<400&&Math.cos(c.angle)<-.7&&traffic.active&&traffic.y>100&&traffic.y<440)this.add('yield');
  this.condition('speed',kmh(c)>40.5,'Лимит участка: 40 км/ч');
  this.condition('sidewalk',corners(c).some(p=>!onRoad(p.x,p.y)));
  const inIntersection=(x,y)=>[400,1200,1600].some(v=>Math.abs(x-v)<100)&&[400,1120].some(v=>Math.abs(y-v)<100);
  let crossed=false;
  for(const y of [400,1120])if((prev.y-y)*(c.y-y)<0&&!inIntersection(c.x,c.y)&&c.x>100&&c.x<2000)crossed=true;
  for(const x of [400,1200,1600])if((prev.x-x)*(c.x-x)<0&&!inIntersection(c.x,c.y)&&c.y>160&&c.y<1340)crossed=true;
  if(crossed)this.add('line');
  if(prev.y<=1215&&c.y>1215&&c.x>1520&&c.x<1680)this.add('turn');
  // One event per continuous steering manoeuvre, measured from its actual onset.
  if(Math.abs(c.steer)>.12&&Math.abs(c.speed)>4&&!this.maneuver){
   this.maneuver={angle:prev.angle,side:c.steer*c.speed>0?'right':'left',signalled:this.signalValid(c.steer*c.speed>0?'right':'left'),reported:false};
  }
  if(this.maneuver){
   if(Math.abs(norm(c.angle-this.maneuver.angle))>.22&&!this.maneuver.reported){
    if(!this.maneuver.signalled)this.add('signal','Поворот или перестроение');
    this.maneuver.reported=true;
   }
   if(Math.abs(c.steer)<.06||Math.abs(c.speed)<1)this.maneuver=null;
  }
  const hitBuilding=SOLIDS.some(r=>corners(c).some(p=>contains(r,p.x,p.y)));
  const hitTraffic=traffic.active&&Math.abs(c.x-traffic.x)<32&&Math.abs(c.y-traffic.y)<38;
  const hitPerson=pedestrian.active&&Math.hypot(c.x-pedestrian.x,c.y-pedestrian.y)<23;
  const hit=hitBuilding||hitTraffic||hitPerson;
  this.condition('collision',hit);
  if(hit){c.x=prev.x;c.y=prev.y;c.speed=0;}
  if(c.x<70||c.x>2030||c.y<90||c.y>1410){c.x=prev.x;c.y=prev.y;c.speed=0;}
  const target=ROUTE[this.stage];
  if(this.stage<ROUTE.length-1&&Math.hypot(c.x-target.x,c.y-target.y)<85)this.stage++;
  if(this.stage===ROUTE.length-1){
   const parked=corners(c).every(p=>contains(PARK,p.x,p.y, -6))&&Math.abs(c.speed)<.15&&Math.abs(norm(c.angle))<.2;
   this.parkHold=parked?this.parkHold+dt:0;
   if(this.parkHold>=2){this.status='finished';this.car.speed=0;}
  }
  if(this.time>=this.recordAt){this.trace.push({t:Math.round(this.time),x:Math.round(c.x),y:Math.round(c.y)});this.recordAt=this.time+1;}
 }
 report(){return {app:'Практика ПДД',version:'0.1.0',completed:this.status==='finished',duration:Math.round(this.time),checkpoints:this.stage,totalCheckpoints:ROUTE.length-1,faults:this.faults,trace:this.trace,notice:'Учебный протокол. Не официальная оценка экзамена ГИБДД.'};}
}
