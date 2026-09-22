import {corners} from './car.js';
export function overlap(a,b) {
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],axis={x:-(q.y-p.y),y:q.x-p.x};
  const aa=a.map(v=>v.x*axis.x+v.y*axis.y),bb=b.map(v=>v.x*axis.x+v.y*axis.y);
  if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))return false;
 }return true;
}
export function body(car){const p=corners(car);return [p[0],p[1],p[3],p[2]];}
export function rectangle(r){return [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];}
export function contactBetween(previous,current,previousOther,other) {
 for(let i=0;i<=6;i++){
  const t=i/6,lerp=(a,b)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:a.angle+Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle))*t});
  if(overlap(body(lerp(previous,current)),body(lerp(previousOther,other))))return true;
 }return false;
}
