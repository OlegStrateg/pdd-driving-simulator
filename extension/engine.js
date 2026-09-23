
import {createCar,advanceCar,corners,kmh,norm} from './car.js';
import {ROUTE,RULES,SOLIDS,PARK,contains,onRoad,lightAt,trafficAt,pedestrianAt} from './level.js';
import {pedestrianMustYield,crossesOccupiedZebra} from './pedestrians.js';
import {overlap,body,rectangle,contactBetween} from './collisions.js';
export class Exam {
 constructor(){this.reset();}
 reset(){
  this.car=createCar(); this.time=0;this.startedAt=0;this.status='ready';this.stage=0;this.faults=[];this.active=new Set();
  this.pedestrianEvents=new Set();this.hazards={pedestrian:false};
  this.stopDone=false;this.stopHold=0;this.parkHold=0;this.started=false;
  this.signalTurn=null;this.approachLane=null;this.maneuver=null;this.lastTurnTime=-10;this.trace=[];this.recordAt=0;
 }
 start(scenario='route'){this.reset();this.scenario=scenario;this.status='running';if(scenario==='pedestrian'){this.car.x=650;this.time=2;this.started=true;}if(scenario==='priority'){Object.assign(this.car,{x:1420,y:360,angle:Math.PI});this.time=15.2;this.stage=6;this.started=true;}this.startedAt=this.time;}
 signal(value){this.car.signal=value==='off'||this.car.signal===value?'off':value;this.car.signalSince=this.time;this.signalTurn=this.car.signal==='off'?null:{angle:this.car.angle,side:this.car.signal,turned:false,settled:0};}
 add(code,detail='',evidence={}){
  this.faults.push({id:this.faults.length+1,evidence,code,...RULES[code],detail,simTime:this.time,time:Math.round((this.time-this.startedAt)*10)/10,x:Math.round(this.car.x),y:Math.round(this.car.y)});
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
  if(this.signalTurn){
   const turn=this.signalTurn,delta=norm(c.angle-turn.angle);
   if((turn.side==='left'&&delta<-.65)||(turn.side==='right'&&delta>.65))turn.turned=true;
   turn.settled=turn.turned&&Math.abs(c.steer)<.1?turn.settled+dt:0;
   if(turn.settled>.45){c.signal='off';this.signalTurn=null;}
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
  this.hazards.pedestrian=pedestrianMustYield(c,pedestrian)&&Math.abs(c.x-800)<250;
  const pedestrianKey=Math.floor(this.time/16)+':'+(Math.cos(c.angle)>=0?'east':'west');
  if(crossesOccupiedZebra(prev,c,pedestrian)&&!this.pedestrianEvents.has(pedestrianKey)){
   this.pedestrianEvents.add(pedestrianKey);
   this.add('pedestrian','Въезд на занятый переход до освобождения траектории пешеходом.',{
    pedestrianX:pedestrian.x,pedestrianY:Math.round(pedestrian.y),speedKmh:Math.round(kmh(c)*10)/10,crossing:'Садовая, 01'
   });
  }
  const traffic=trafficAt(this.time);
  const westNose=c.x-22,oldWestNose=prev.x-22;
  if(oldWestNose>1295&&westNose<=1295&&c.y>320&&c.y<400&&Math.cos(c.angle)<-.7&&traffic.active&&traffic.y>100&&traffic.y<440)this.add('yield');
  this.condition('speed',kmh(c)>40.5,'Лимит участка: 40 км/ч');
  this.condition('sidewalk',corners(c).some(p=>!onRoad(p.x,p.y)));
  const inIntersection=(x,y)=>[400,1200,1600].some(v=>Math.abs(x-v)<100)&&[400,1120].some(v=>Math.abs(y-v)<100);
  const junction=inIntersection(c.x,c.y);
  const eastWest=Math.abs(Math.cos(c.angle))>.75;
  const northSouth=Math.abs(Math.sin(c.angle))>.75;
  let wrongLane=false,laneKnown=false;
  if(!junction&&c.speed>2){
   for(const y of [400,1120])if(Math.abs(c.y-y)<78&&eastWest){wrongLane=Math.cos(c.angle)>0?c.y<y:c.y>y;laneKnown=true;}
   for(const x of [400,1200,1600])if(Math.abs(c.x-x)<78&&northSouth){wrongLane=Math.sin(c.angle)>0?c.x>x:c.x<x;laneKnown=true;}
   if(laneKnown)this.approachLane={wrong:wrongLane,time:this.time};
  }
  this.condition('oncoming',wrongLane);
  this.condition('reverseJunction',junction&&c.speed<-2);
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
    if(junction&&this.approachLane?.wrong&&this.time-this.approachLane.time<4)this.add('turnLane');
    this.maneuver.reported=true;
   }
   if(Math.abs(c.steer)<.06||Math.abs(c.speed)<1)this.maneuver=null;
  }
  const hitBuilding=SOLIDS.some(r=>overlap(body(c),rectangle(r)));
  const oldTraffic=trafficAt(this.time-dt);
  const hitTraffic=traffic.active&&oldTraffic.active&&Math.abs(traffic.y-oldTraffic.y)<30&&contactBetween(prev,c,oldTraffic,traffic);
  const hitPerson=pedestrian.active&&overlap(body(c),rectangle({x:pedestrian.x-5,y:pedestrian.y-5,w:10,h:10}));
  const hit=hitBuilding||hitTraffic||hitPerson;
  if(hit){
   this.add('collision',hitTraffic?'Контакт с другим автомобилем':hitPerson?'Наезд на пешехода':'Контакт с препятствием',{participant:hitTraffic?'car':hitPerson?'pedestrian':'building',speedKmh:Math.round(kmh(c)),otherX:hitTraffic?traffic.x:null,otherY:hitTraffic?Math.round(traffic.y):null});
   c.x=prev.x;c.y=prev.y;c.speed=0;this.status='accident';return;
  }
  if(c.x<70||c.x>2030||c.y<90||c.y>1410){c.x=prev.x;c.y=prev.y;c.speed=0;}
  if(this.scenario==='pedestrian'&&c.x>875){this.status='finished';c.speed=0;return;}
  if(this.scenario==='priority'&&c.x<1100){this.status='finished';c.speed=0;return;}
  const target=ROUTE[this.stage];
  if(this.stage<ROUTE.length-1&&Math.hypot(c.x-target.x,c.y-target.y)<85)this.stage++;
  if(this.stage===ROUTE.length-1){
   const parked=corners(c).every(p=>contains(PARK,p.x,p.y, -6))&&Math.abs(c.speed)<.15&&Math.abs(norm(c.angle))<.2;
   this.parkHold=parked?this.parkHold+dt:0;
   if(this.parkHold>=2){this.status='finished';this.car.speed=0;}
  }
  if(this.time>=this.recordAt){this.trace.push({t:Math.round(this.time-this.startedAt),x:Math.round(c.x),y:Math.round(c.y)});this.recordAt=this.time+1;}
 }
 report(){return {app:'Практика ПДД',version:'0.3.0',scenario:this.scenario||'route',completed:this.status==='finished',accident:this.status==='accident',duration:Math.round(this.time-this.startedAt),checkpoints:this.stage,totalCheckpoints:ROUTE.length-1,faults:this.faults,trace:this.trace,notice:'Учебный протокол. Не официальная оценка экзамена ГИБДД.'};}
}
