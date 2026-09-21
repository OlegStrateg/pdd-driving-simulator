
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function createCar(){return {x:530,y:1160,angle:0,speed:0,steer:0,signal:'off',signalSince:0};}
export function corners(c) {
 const ca=Math.cos(c.angle),sa=Math.sin(c.angle);
 return [[22,11],[22,-11],[-22,11],[-22,-11]].map(([x,y])=>({x:c.x+x*ca-y*sa,y:c.y+x*sa+y*ca}));
}
export function advanceCar(c,input,dt) {
 const direction=(input.right?1:0)-(input.left?1:0);
 c.steer+=(direction*.56-c.steer)*Math.min(1,dt*8);
 if(input.brake) c.speed=Math.sign(c.speed)*Math.max(0,Math.abs(c.speed)-100*dt);
 else if(input.gas) c.speed=clamp(c.speed+34*dt,-35,128);
 else if(input.reverse) c.speed=clamp(c.speed-22*dt,-35,128);
 else c.speed=Math.sign(c.speed)*Math.max(0,Math.abs(c.speed)-12*dt);
 c.angle=norm(c.angle+c.speed/36*Math.tan(c.steer)*dt);
 c.x+=Math.cos(c.angle)*c.speed*dt; c.y+=Math.sin(c.angle)*c.speed*dt;
}
export const kmh=c=>Math.abs(c.speed)*.72;
