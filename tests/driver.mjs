
export const path = [
 [760,1160],[900,1160],[1327,1160],[1380,1160],[1540,1160],
 [1580,1157],[1615,1137],[1637,1100],[1640,1020],[1640,826],[1640,730],[1640,530],
 [1640,455],[1637,420],[1615,382],[1580,362],[1480,360],[1319,360],[1020,360],[530,360],
 [455,360],[415,365],[382,389],[362,425],[360,520],[360,1000],[360,1075],
 [365,1110],[389,1141],[425,1159],[550,1160],[740,1160],[775,1160],
 [810,1166],[850,1188],[890,1220],[925,1240],[960,1248],[1010,1248]
];
const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function driver(state,memory){
 const c=state, t=+c.time;
 if(memory.index===undefined)memory.index=0;
 let target=path[memory.index];
 if(Math.hypot(+c.x-target[0],+c.y-target[1])<32&&memory.index<path.length-1)target=path[++memory.index];
 const dx=target[0]-c.x,dy=target[1]-c.y;
 const error=norm(Math.atan2(dy,dx)-c.angle);
 let desired=Math.abs(error)>.25?27:47;
 let brake=false;
 // Approach STOP with a stopping-distance envelope; wait for actual standstill.
 if(memory.index<=3&&+c.x>1200&&+c.x<1330&&c.stop!=='true'){
  const gap=1327-c.x;desired=Math.min(desired,Math.sqrt(Math.max(0,gap-1)*130));
  if(gap<2)desired=0;
 }
 // Stay behind the light line until green.
 if(memory.index>=8&&memory.index<=10&&+c.y>823&&+c.y<980&&t%18>=0&&!(t%18>=8&&t%18<16)){
  desired=Math.min(desired,Math.sqrt(Math.max(0,c.y-826)*130));if(+c.y<828)desired=0;
 }
 // Avoid the crossing pedestrian while its path conflicts with ours.
 if(+c.x>650&&+c.x<756&&+c.y>1120&&memory.index<3){
  const phase=t%16,pedY=1020+phase*20;
  if(phase<10&&pedY>1080&&pedY<1205){desired=Math.min(desired,Math.sqrt(Math.max(0,752-c.x)*130));if(+c.x>750)desired=0;}
 }
 if(memory.index>=16&&memory.index<=18&&+c.x>1318&&+c.x<1450){
  const phase=t%16;if(phase<3.4){desired=Math.min(desired,Math.sqrt(Math.max(0,c.x-1320)*130));if(+c.x<1322)desired=0;}
 }
 const last=memory.index===path.length-1;
 if(last){desired=Math.min(20,Math.sqrt(Math.max(0,995-c.x)*110));if(c.x>=994)desired=0;}
 brake=+c.speed>desired+1;
 const input={gas:+c.speed<desired-1,brake,left:error<-.035,right:error>.035};
 const wantedSignal=memory.index>=32?'right':'left';
 return {input,signal:wantedSignal,error,index:memory.index};
}
