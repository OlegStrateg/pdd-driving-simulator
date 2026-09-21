
import {WORLD,ROADS,SOLIDS,PARK,ROUTE,lightAt,trafficAt,pedestrianAt} from './level.js';
export class Renderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera={x:960,y:810};this.overview=true;}
 draw(exam,dt){
  const canvas=this.canvas,ctx=this.ctx;
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#b5c8b0';ctx.fillRect(0,0,w,h);
  const c=exam.car;
  const scale=this.overview?Math.min(w/2200,h/1580):Math.min(1.3,Math.max(.65,w/1000));
  const target=this.overview?{x:1050,y:780}:{x:c.x+Math.cos(c.angle)*125,y:c.y+Math.sin(c.angle)*125};
  this.camera.x+=(target.x-this.camera.x)*Math.min(1,dt*5);
  this.camera.y+=(target.y-this.camera.y)*Math.min(1,dt*5);
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(scale,scale);ctx.translate(-this.camera.x,-this.camera.y);
  this.city(ctx,exam.time);
  // Route is a dashed educational guide through the right-hand lanes.
  ctx.strokeStyle='#d9f5a780';ctx.lineWidth=3;ctx.setLineDash([9,14]);ctx.beginPath();ctx.moveTo(530,1160);
  for(const p of ROUTE)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);
  const p=ROUTE[exam.stage];
  ctx.strokeStyle='#ecffb3';ctx.fillStyle='#d6f78a35';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,37+Math.sin(exam.time*3)*3,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f1ffd0';ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.fillText(String(exam.stage+1).padStart(2,'0'),p.x,p.y+6);
  const traffic=trafficAt(exam.time);if(traffic.active)this.car(ctx,{...traffic,signal:'off'},'#e5cf98',exam.time);
  const ped=pedestrianAt(exam.time);
  if(ped.active){ctx.fillStyle='#293d3740';ctx.beginPath();ctx.ellipse(ped.x+4,ped.y+6,9,5,0,0,7);ctx.fill();ctx.fillStyle='#da936c';ctx.fillRect(ped.x-6,ped.y-4,12,12);ctx.fillStyle='#e7bf99';ctx.beginPath();ctx.arc(ped.x,ped.y-6,5,0,7);ctx.fill();ctx.strokeStyle='#284c4a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ped.x-3,ped.y+6);ctx.lineTo(ped.x-5,ped.y+12);ctx.moveTo(ped.x+3,ped.y+6);ctx.lineTo(ped.x+5,ped.y+12);ctx.stroke();}
  this.car(ctx,c,'#e5f2d7',exam.time,true);
  ctx.restore();
  const shade=ctx.createLinearGradient(0,h-180,0,h);shade.addColorStop(0,'#183a2f00');shade.addColorStop(1,'#183a2f70');ctx.fillStyle=shade;ctx.fillRect(0,h-180,w,180);
  if(!this.overview)this.minimap(ctx,w,h,exam);
 }
 city(ctx,time){
  ctx.fillStyle='#b4c9ac';ctx.fillRect(0,0,WORLD.width,WORLD.height);
  // Deterministic original park landscaping.
  ctx.fillStyle='#a2bd97';ctx.fillRect(495,490,580,525);
  ctx.strokeStyle='#cdd4b7';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(510,745);ctx.bezierCurveTo(680,690,760,760,1070,710);ctx.stroke();
  ctx.fillStyle='#87b2aa';ctx.beginPath();ctx.ellipse(909,703,95,39,-.25,0,7);ctx.fill();ctx.strokeStyle='#c3d7b8';ctx.lineWidth=8;ctx.stroke();
  ctx.fillStyle='#91bab4';ctx.beginPath();ctx.ellipse(905,700,72,23,-.25,0,7);ctx.fill();
  for(const r of ROADS){ctx.fillStyle='#ccd1bd';ctx.fillRect(r.x-18,r.y-18,r.w+36,r.h+36);ctx.fillStyle='#e1dfcd';ctx.fillRect(r.x-5,r.y-5,r.w+10,r.h+10);}
  for(const r of ROADS){ctx.fillStyle='#586765';ctx.fillRect(r.x,r.y,r.w,r.h);}
  ctx.fillStyle='#64736d';ctx.fillRect(PARK.x,PARK.y,PARK.w,PARK.h);
  ctx.strokeStyle='#d7edab';ctx.lineWidth=3;ctx.strokeRect(PARK.x+6,PARK.y+6,PARK.w-12,PARK.h-12);
  ctx.font='bold 33px system-ui';ctx.fillStyle='#d7edab';ctx.textAlign='center';ctx.fillText('P',940,1262);
  // Center lines leave intersections clear.
  ctx.strokeStyle='#e2dfc6';ctx.lineWidth=2.5;
  for(const y of [400,1120])for(const [a,b] of [[105,317],[483,1117],[1283,1517],[1683,1995]]){ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(b,y);ctx.stroke();}
  for(const x of [400,1200,1600])for(const [a,b] of [[165,317],[483,1037],[1203,1335]]){ctx.beginPath();ctx.moveTo(x,a);ctx.lineTo(x,b);ctx.stroke();}
  // Edge lane markings.
  ctx.strokeStyle='#b9c1b6';ctx.lineWidth=2;ctx.setLineDash([12,18]);
  for(const y of [326,474,1046,1194])for(const [a,b] of [[485,1115],[1285,1515]]){ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(b,y);ctx.stroke();}
  ctx.setLineDash([]);
  // Zebra crossing across both lanes.
  ctx.fillStyle='#e2e2cc';for(let y=1048;y<1194;y+=22)ctx.fillRect(775,y,50,12);
  ctx.fillRect(1498,1123,4,73);ctx.fillRect(1603,798,73,4);for(let x=1528;x<1672;x+=22)ctx.fillRect(x,730,12,45);
  ctx.setLineDash([8,5]);ctx.strokeStyle='#eee6cb';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(1295,324);ctx.lineTo(1295,398);ctx.stroke();ctx.setLineDash([]);
  this.roadText(ctx,'СТОП',1470,1160,-Math.PI/2);
  this.roadText(ctx,'ПАРКОВАЯ',359,760,-Math.PI/2);
  this.roadText(ctx,'НАБЕРЕЖНАЯ',1640,660,-Math.PI/2);
  this.roadText(ctx,'ЗЕЛЁНЫЙ ПРОСПЕКТ',770,361,0);
  this.roadText(ctx,'УЛИЦА САДОВАЯ',1050,1161,0);
  // Lane direction arrows, also showing right-hand circulation.
  for(const [x,y,a] of [[660,1160,0],[1460,1160,0],[1640,945,-Math.PI/2],[1640,570,-Math.PI/2],[1410,360,Math.PI],[600,360,Math.PI],[360,880,Math.PI/2]])this.arrow(ctx,x,y,a);
  for(let i=0;i<SOLIDS.length;i++)this.building(ctx,SOLIDS[i],i);
  // Trees placed in sidewalks/parks, with soft offset shadows.
  for(const [x,y] of [[530,495],[750,490],[1000,505],[510,810],[850,900],[1060,970],[1045,600],[545,985],[730,985],[880,985],[1410,965],[1450,500],[1730,855],[1810,885],[1870,940],[250,550],[255,660],[255,790],[250,935],[510,240],[905,225],[1030,240],[1780,265],[1890,280],[680,690],[610,740],[750,790]])this.tree(ctx,x,y);
  // Street lamps cast small diagonal shadows.
  for(const [x,y] of [[700,1225],[1440,1225],[1715,990],[1715,560],[1020,290],[520,290],[285,540],[285,1020]]){
   ctx.strokeStyle='#4d655a40';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+25,y+20);ctx.stroke();
   ctx.fillStyle='#364e48';ctx.fillRect(x-2,y-24,4,24);ctx.fillStyle='#ece9c7';ctx.fillRect(x-5,y-30,10,8);
  }
  this.sign(ctx,835,1218,'cross');this.sign(ctx,1475,1220,'stop');this.sign(ctx,1520,1240,'no-right');
  this.sign(ctx,655,1220,'40');this.sign(ctx,1320,286,'yield');this.sign(ctx,1720,812,'light',lightAt(time));
  this.sign(ctx,1070,1260,'P');
 }
 roadText(ctx,text,x,y,a){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#ffffff35';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(text,0,0);ctx.restore();}
 tree(ctx,x,y){ctx.fillStyle='#244e3324';ctx.beginPath();ctx.ellipse(x+12,y+13,25,19,.5,0,7);ctx.fill();ctx.fillStyle='#77986a';ctx.beginPath();ctx.arc(x,y,23,0,7);ctx.fill();ctx.fillStyle='#88a979';ctx.beginPath();ctx.arc(x-6,y-6,17,0,7);ctx.fill();ctx.fillStyle='#96b383';ctx.beginPath();ctx.arc(x-9,y-10,9,0,7);ctx.fill();}
 building(ctx,r,i){
  ctx.fillStyle='#28423924';ctx.fillRect(r.x+17,r.y+20,r.w+8,r.h+8);
  ctx.fillStyle='#a3aba0';ctx.fillRect(r.x,r.y+10,r.w,r.h);
  ctx.fillStyle=['#d5c6a8','#c8d0c3','#b8cac7'][i%3];ctx.fillRect(r.x,r.y,r.w,r.h-5);
  ctx.strokeStyle='#f0ebd480';ctx.lineWidth=4;ctx.strokeRect(r.x+7,r.y+7,r.w-14,r.h-19);
  ctx.fillStyle='#a9b5ad';ctx.fillRect(r.x+20,r.y+20,r.w-40,20);
  ctx.fillStyle='#8caaa5';for(let x=r.x+17;x<r.x+r.w-10;x+=25)ctx.fillRect(x,r.y+r.h-3,13,7);
  ctx.fillStyle='#a0ada6';ctx.fillRect(r.x+20,r.y+56,20,18);ctx.fillStyle='#e0e4d6';ctx.fillRect(r.x+20,r.y+52,20,18);
 }
 arrow(ctx,x,y,a){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.strokeStyle='#dfe2ce90';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-17,0);ctx.lineTo(17,0);ctx.lineTo(6,-8);ctx.moveTo(17,0);ctx.lineTo(6,8);ctx.stroke();ctx.restore();}
 sign(ctx,x,y,kind,state){
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#263c3930';ctx.fillRect(3,4,5,28);ctx.fillStyle='#8b9990';ctx.fillRect(-2,0,4,24);
  if(kind==='light'){ctx.fillStyle='#263b37';ctx.fillRect(-12,-53,24,62);for(const [i,color] of ['red','yellow','green'].entries()){ctx.fillStyle=state===color?{red:'#ff7867',yellow:'#ffe58b',green:'#c7f38b'}[color]:'#52645a';ctx.beginPath();ctx.arc(0,-41+i*19,7,0,7);ctx.fill();}}
  else if(kind==='stop'){ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;const px=Math.cos(a)*22,py=Math.sin(a)*22-12;if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fillStyle='#bb5c51';ctx.fill();ctx.strokeStyle='#f7edda';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff6e1';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('STOP',0,-8);}
  else if(kind==='yield'){ctx.beginPath();ctx.moveTo(-23,-30);ctx.lineTo(23,-30);ctx.lineTo(0,9);ctx.closePath();ctx.fillStyle='#f6eedb';ctx.fill();ctx.strokeStyle='#bf6254';ctx.lineWidth=5;ctx.stroke();}
  else if(kind==='40'||kind==='no-right'){ctx.fillStyle='#f7f1df';ctx.beginPath();ctx.arc(0,-14,21,0,7);ctx.fill();ctx.strokeStyle='#c16253';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#2a403c';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText(kind==='40'?'40':'↱',0,-7);if(kind==='no-right'){ctx.beginPath();ctx.moveTo(-15,1);ctx.lineTo(15,-29);ctx.stroke();}}
  else {ctx.fillStyle='#57877d';ctx.fillRect(-20,-35,40,40);ctx.strokeStyle='#eee9d6';ctx.lineWidth=2;ctx.strokeRect(-18,-33,36,36);ctx.fillStyle='#faf6e7';ctx.font='bold 24px system-ui';ctx.textAlign='center';if(kind==='P')ctx.fillText('P',0,-6);else{ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(-16,-2);ctx.lineTo(16,-2);ctx.closePath();ctx.fill();ctx.strokeStyle='#29423d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-21,2,0,7);ctx.moveTo(0,-18);ctx.lineTo(-2,-11);ctx.lineTo(-7,-5);ctx.moveTo(-2,-11);ctx.lineTo(5,-5);ctx.moveTo(-1,-16);ctx.lineTo(6,-12);ctx.moveTo(-1,-16);ctx.lineTo(-7,-12);ctx.stroke();}}
  ctx.restore();
 }
 car(ctx,c,color,time,player=false){
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);
  if(player){ctx.fillStyle='#d9f28c18';ctx.beginPath();ctx.ellipse(0,0,37,25,0,0,7);ctx.fill();}
  ctx.fillStyle='#15292740';ctx.fillRect(-19,-7,46,24);
  ctx.fillStyle='#203b36';for(const x of [-15,11])for(const y of [-14,10])ctx.fillRect(x,y,9,4);
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-22,-11,44,22,5);ctx.fill();
  ctx.fillStyle='#41665f';ctx.beginPath();ctx.roundRect(-10,-9,22,18,4);ctx.fill();
  ctx.fillStyle=color;ctx.fillRect(-6,-8,12,16);
  ctx.fillStyle='#a9c5b7';ctx.fillRect(7,-8,5,16);
  ctx.fillStyle='#f7efb8';ctx.fillRect(19,-8,3,5);ctx.fillRect(19,3,3,5);
  ctx.fillStyle='#bd6d59';ctx.fillRect(-23,-8,3,5);ctx.fillRect(-23,3,3,5);
  if(c.signal!=='off'&&time%1<.5){ctx.fillStyle='#ffd378';const y=c.signal==='left'?-13:10;ctx.fillRect(14,y,7,3);ctx.fillRect(-20,y,5,3);}
  ctx.restore();
 }
 minimap(ctx,w,h,e){
  const mx=w-144,my=h-143;ctx.save();ctx.fillStyle='#f4f4e6ed';ctx.beginPath();ctx.roundRect(mx,my,123,99,10);ctx.fill();ctx.translate(mx+6,my+5);ctx.scale(.052,.052);
  ctx.fillStyle='#b1bfac';ctx.fillRect(0,0,2100,1500);ctx.fillStyle='#72837b';for(const r of ROADS)ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.fillStyle='#de754e';ctx.beginPath();ctx.arc(e.car.x,e.car.y,55,0,7);ctx.fill();ctx.restore();
 }
}
