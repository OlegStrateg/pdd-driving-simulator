import {ROADS,SOLIDS,PARK,ROUTE,trafficAt,pedestrianAt,lightAt} from './level.js';
const shade=(hex,k)=>{const n=parseInt(hex.slice(1),16);return 'rgb('+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(Math.min(255,v*k))).join(',')+')';};
export function cameraPoint(p,camera) {
 const dx=p[0]-camera.x,dy=p[1]-camera.y,dz=p[2]-camera.z;
 return [dx*camera.right[0]+dy*camera.right[1],dx*camera.up[0]+dy*camera.up[1]+dz*camera.up[2],dx*camera.forward[0]+dy*camera.forward[1]+dz*camera.forward[2]];
}
export function clipNear(points,near=6) {
 const out=[];for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],insideA=a[2]>=near,insideB=b[2]>=near;
  if(insideA)out.push(a);
  if(insideA!==insideB){const t=(near-a[2])/(b[2]-a[2]);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
 }return out;
}
export class Renderer3D {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.overview=false;this.angle=0;this.static=[];this.ground=[];this.labels=[];this.makeCity();}
 polygon(points,color,list=this.static){list.push({points,color});}
 flat(x,y,w,h,color,z=.2){this.polygon([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],color,this.ground);}
 box(x,y,z,w,d,h,color,list=this.static,angle=0){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const p=[[-w/2,-d/2,0],[w/2,-d/2,0],[w/2,d/2,0],[-w/2,d/2,0],[-w/2,-d/2,h],[w/2,-d/2,h],[w/2,d/2,h],[-w/2,d/2,h]].map(([a,b,c])=>[x+a*ca-b*sa,y+a*sa+b*ca,z+c]);
  const faces=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]];
  faces.forEach((face,i)=>this.polygon(face.map(v=>p[v]),shade(color,[.73,.85,.95,.8,1.08][i]),list));
 }
 crown(x,y,z,r,h,list=this.static){
  const ring=Array.from({length:8},(_,i)=>[x+Math.cos(i*Math.PI/4)*r,y+Math.sin(i*Math.PI/4)*r,z]);
  for(let i=0;i<8;i++)this.polygon([ring[i],ring[(i+1)%8],[x,y,z+h]],shade('#5c9e71',.8+i*.04),list);
  this.polygon(ring,'#498363',list);
 }
 makeCity(){
  this.flat(-5000,-5000,12000,12000,'#87a891',-.5);
  for(const r of ROADS)this.flat(r.x-19,r.y-19,r.w+38,r.h+38,'#c0c6b8',-.1);
  for(const r of ROADS)this.flat(r.x,r.y,r.w,r.h,'#424e53',0);
  this.flat(PARK.x,PARK.y,PARK.w,PARK.h,'#506d5e',.1);
  for(const y of [PARK.y+4,PARK.y+PARK.h-6])this.flat(PARK.x+4,y,PARK.w-8,2,'#c9f093');
  for(const x of [PARK.x+4,PARK.x+PARK.w-6])this.flat(x,PARK.y+4,2,PARK.h-8,'#c9f093');
  for(const y of [400,1120])for(const [a,b] of [[100,318],[482,1118],[1282,1518],[1682,2000]])this.flat(a,y-1,b-a,2,'#e8e6db');
  for(const x of [400,1200,1600])for(const [a,b] of [[160,318],[482,1038],[1202,1340]])this.flat(x-1,a,2,b-a,'#e8e6db');
  for(let y=1048;y<1194;y+=22)this.flat(775,y,50,12,'#fbf5dd',.5);
  for(let x=1528;x<1672;x+=22)this.flat(x,730,12,45,'#fbf5dd',.5);
  this.flat(1498,1122,4,76,'#fbf5dd',.5);this.flat(1602,798,76,4,'#fbf5dd',.5);
  for(let y=323;y<395;y+=14)this.flat(1295,y,4,8,'#f3e8ca',.5);
  SOLIDS.forEach((r,i)=>{
   const height=[90,130,75,150,112,150,95,100][i%8],color=['#d4c7b1','#b4c9c7','#d9c9b5','#c3c8cc'][i%4];
   this.flat(r.x+18,r.y+20,r.w+18,r.h+20,'#6d8c77',.05);
   this.box(r.x+r.w/2,r.y+r.h/2,0,r.w,r.h,height,color);
   this.box(r.x+r.w/2,r.y+r.h/2,height,r.w+8,r.h+8,5,'#eeeecc');
   this.box(r.x+r.w/2,r.y+r.h/2,height+5,r.w*.55,r.h*.45,8,'#75908e');
   for(let z=18;z<height-12;z+=27){
    for(let x=r.x+16;x<r.x+r.w-10;x+=28)for(const y of [r.y-.5,r.y+r.h+.5]){
     this.polygon([[x,y,z],[x+13,y,z],[x+13,y,z+17],[x,y,z+17]],'#659399');
     this.polygon([[x,y,z+15],[x+13,y,z+15],[x+13,y,z+17],[x,y,z+17]],'#e1dac0');
    }
    for(let y=r.y+16;y<r.y+r.h-10;y+=28)for(const x of [r.x-.5,r.x+r.w+.5])this.polygon([[x,y,z],[x,y+13,z],[x,y+13,z+17],[x,y,z+17]],'#6e989f');
   }
   this.box(r.x+r.w*.6,r.y+r.h+1,0,17,2,26,'#345666');
  });
  const trees=[[250,550],[250,720],[250,940],[530,495],[745,490],[1000,505],[510,790],[1050,960],[540,975],[850,975],[1420,970],[1460,495],[1740,850],[1850,880],[580,240],[890,230],[1020,235],[1780,265],[1880,280],[650,745],[745,770],[560,1250],[680,1250],[1080,1295],[1360,1250],[1470,1270],[1740,1250],[1880,1250]];
  trees.forEach(([x,y],i)=>{this.flat(x-18,y-8,55,42,'#719680',.1);this.box(x,y,0,6,6,27,'#7b735b');this.crown(x,y,23,27,35);this.crown(x,y,42,21,32);});
  for(const [x,y] of [[695,1223],[1450,1223],[1715,990],[1715,550],[1020,285],[520,285],[285,540],[285,1000]]){
   this.box(x,y,0,3,3,72,'#536269');this.box(x,y-10,72,4,24,3,'#687779');this.box(x,y-19,70,9,11,2,'#f4e4b5');
  }
  this.sign(650,1218,'40','#bc5144');
  this.sign(840,1218,'ПЕШЕХОД','#33778e');
  this.sign(1480,1218,'STOP','#b94e41');
  this.sign(1530,1235,'↱ ×','#b94e41');
  this.sign(1315,295,'УСТУПИ','#b94e41');
  this.sign(1045,1260,'P','#397b8f');
 }
 sign(x,y,text,color){this.box(x,y,0,2,2,46,'#a4aba3');this.labels.push({x,y,z:57,text,color});}
 vehicle(c,color,list,braking=false,time=0){
  const part=(a,b,z,w,d,h,col)=>this.box(c.x+a*Math.cos(c.angle)-b*Math.sin(c.angle),c.y+a*Math.sin(c.angle)+b*Math.cos(c.angle),z,w,d,h,col,list,c.angle);
  part(0,0,5,44,22,10,color);part(-2,0,15,23,19,8,'#304e5c');part(-3,0,22,16,18,2,color);
  part(16,0,14,9,20,2,color);part(-18,0,13,6,20,2,color);
  for(const a of [-14,13])for(const b of [-11,11]){part(a,b,2,9,4,9,'#243237');part(a,b*1.2,4,4,1,5,'#a7b2af');}
  for(const b of [-7,7]){part(22,b,9,1,5,3,'#fff1ba');part(-22,b,9,1,5,3,braking?'#ff523d':'#ae4d45');}
  for(const b of [-13,13])part(5,b,15,4,4,2,color);
  if(c.signal!=='off'&&time%1<.5)for(const a of [-20,18])part(a,c.signal==='left'?-11:11,11,3,2,3,'#ffbf45');
 }
 pedestrian(p,time,list){
  if(!p.active)return;
  const swing=Math.sin(time*9)*3;
  this.box(p.x,p.y,11,9,6,13,'#ef965c',list);
  this.box(p.x,p.y,25,6,6,7,'#f1c89c',list);
  this.box(p.x-3,p.y+swing,1,3,4,11,'#344758',list);
  this.box(p.x+3,p.y-swing,1,3,4,11,'#344758',list);
  this.box(p.x-6,p.y-swing,12,3,3,11,'#e7b889',list);
  this.box(p.x+6,p.y+swing,12,3,3,11,'#e7b889',list);
 }
 draw(exam,dt){
  const ctx=this.ctx,canvas=this.canvas,w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#76aec4');sky.addColorStop(.58,'#e0e9d8');sky.addColorStop(1,'#a9bb9e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#fff0be';ctx.beginPath();ctx.arc(w*.8,h*.18,29,0,7);ctx.fill();
  const c=exam.car;
  this.angle+=Math.atan2(Math.sin(c.angle-this.angle),Math.cos(c.angle-this.angle))*Math.min(1,dt*4);
  const a=this.angle,cam={x:c.x-Math.cos(a)*155,y:c.y-Math.sin(a)*155,z:94};
  const target={x:c.x+Math.cos(a)*150,y:c.y+Math.sin(a)*150,z:9};
  const delta=[target.x-cam.x,target.y-cam.y,target.z-cam.z],length=Math.hypot(...delta);
  cam.forward=delta.map(x=>x/length);cam.right=[-Math.sin(a),Math.cos(a),0];
  cam.up=[-cam.forward[2]*Math.cos(a),-cam.forward[2]*Math.sin(a),Math.hypot(cam.forward[0],cam.forward[1])];
  const focal=Math.min(w,h)*1.08;
  const project=p=>[w/2+p[0]*focal/p[2],h*.47-p[1]*focal/p[2]];
  const drawFace=face=>{
   const points=clipNear(face.points.map(p=>cameraPoint(p,cam)));
   if(points.length<3)return;
   const projected=points.map(project);
   if(projected.every(p=>p[0]<-20)||projected.every(p=>p[0]>w+20)||projected.every(p=>p[1]<-20)||projected.every(p=>p[1]>h+20))return;
   ctx.beginPath();projected.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();
  };
  this.ground.forEach(drawFace);
  const under=[];
  if(exam.hazards.pedestrian){under.push({points:[[770,1040,.8],[830,1040,.8],[830,1200,.8],[770,1200,.8]],color:'#ffb45377'});}
  const targetPoint=ROUTE[exam.stage];
  for(let i=0;i<3;i++){const size=12+i*6;under.push({points:[[targetPoint.x-size,targetPoint.y,1],[targetPoint.x,targetPoint.y-12,1],[targetPoint.x+size,targetPoint.y,1],[targetPoint.x,targetPoint.y+12,1]],color:'#c8fa91aa'});}
  under.forEach(drawFace);
  const dynamic=[];
  this.vehicle(c,'#d7e9b9',dynamic,c.speed<1,exam.time);
  const other=trafficAt(exam.time);if(other.active)this.vehicle({...other,signal:'off'},'#ddaa73',dynamic,false,exam.time);
  this.pedestrian(pedestrianAt(exam.time),exam.time,dynamic);
  this.box(1700,805,0,3,3,80,'#6e817e',dynamic);this.box(1700,805,65,8,8,30,'#283f40',dynamic);
  const light=lightAt(exam.time);for(const [i,col] of ['red','yellow','green'].entries())this.box(1695,805,87-i*10,2,6,6,light===col?{red:'#ff6551',yellow:'#ffe078',green:'#b6f483'}[col]:'#50645b',dynamic);
  const faces=[...this.static,...dynamic].map(face=>({...face,depth:face.points.reduce((sum,p)=>sum+cameraPoint(p,cam)[2],0)/face.points.length}));
  faces.sort((a,b)=>b.depth-a.depth).forEach(drawFace);
  for(const label of this.labels){
   const p=cameraPoint([label.x,label.y,label.z],cam);
   if(p[2]<12||p[2]>700)continue;
   const [x,y]=project(p),size=Math.min(55,Math.max(12,focal*22/p[2]));
   ctx.save();ctx.translate(x,y);ctx.lineWidth=Math.max(2,size*.09);ctx.textAlign='center';ctx.textBaseline='middle';
   const r=size*.55;
   if(label.text==='40'||label.text==='↱ ×'){
    ctx.fillStyle='#fff9e9';ctx.strokeStyle='#c34639';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#243b38';ctx.font='bold '+size*.54+'px system-ui';ctx.fillText(label.text==='40'?'40':'↱',0,1);
    if(label.text!=='40'){ctx.beginPath();ctx.moveTo(-r*.72,r*.72);ctx.lineTo(r*.72,-r*.72);ctx.stroke();}
   }else if(label.text==='STOP'){
    ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();
    ctx.fillStyle='#bf483c';ctx.strokeStyle='#fff6df';ctx.lineWidth=Math.max(1,size*.04);ctx.fill();ctx.stroke();ctx.fillStyle='#fff6df';ctx.font='bold '+size*.3+'px system-ui';ctx.fillText('STOP',0,0);
   }else if(label.text==='УСТУПИ'){
    ctx.beginPath();ctx.moveTo(-r,-r*.8);ctx.lineTo(r,-r*.8);ctx.lineTo(0,r);ctx.closePath();ctx.fillStyle='#fff8e6';ctx.strokeStyle='#c34639';ctx.fill();ctx.stroke();
   }else{
    ctx.fillStyle='#286fb2';ctx.strokeStyle='#fff6df';ctx.lineWidth=Math.max(1,size*.04);ctx.fillRect(-r,-r,r*2,r*2);ctx.strokeRect(-r,-r,r*2,r*2);
    if(label.text==='P'){ctx.fillStyle='#fff6df';ctx.font='bold '+size*.75+'px system-ui';ctx.fillText('P',0,2);}
    else{
     ctx.fillStyle='#fff6df';ctx.beginPath();ctx.moveTo(0,-r*.83);ctx.lineTo(-r*.85,r*.75);ctx.lineTo(r*.85,r*.75);ctx.closePath();ctx.fill();
     ctx.strokeStyle='#213f3e';ctx.lineWidth=Math.max(1,size*.045);
     ctx.beginPath();ctx.arc(0,-r*.31,r*.1,0,7);ctx.moveTo(0,-r*.15);ctx.lineTo(-r*.1,r*.27);ctx.lineTo(-r*.43,r*.57);ctx.moveTo(-r*.1,r*.27);ctx.lineTo(r*.37,r*.57);ctx.moveTo(0,0);ctx.lineTo(r*.36,r*.21);ctx.moveTo(0,0);ctx.lineTo(-r*.38,r*.18);ctx.stroke();
    }
   }ctx.restore();
  }
  const ped=pedestrianAt(exam.time);
  if(exam.hazards.pedestrian&&ped.active){
   const p=cameraPoint([ped.x,ped.y,43],cam);if(p[2]>6){const [x,y]=project(p);ctx.fillStyle='#fff2c8';ctx.beginPath();ctx.arc(x,y,13,0,7);ctx.fill();ctx.fillStyle='#b65b27';ctx.font='bold 19px system-ui';ctx.textAlign='center';ctx.fillText('!',x,y+7);}
  }
  const fade=ctx.createLinearGradient(0,h-150,0,h);fade.addColorStop(0,'#18382c00');fade.addColorStop(1,'#18382c88');ctx.fillStyle=fade;ctx.fillRect(0,h-150,w,150);
  this.canvas.dataset.rendered='3d';this.canvas.dataset.faces=faces.length;
 }
}
