// OpenStreetMap geometry in metres, north maps to -Z.
export function parsePlace(data,lat,lon,name='Выбранная местность'){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Проверьте координаты');
 if(!Array.isArray(data.elements)||data.elements.length>30000)throw Error('Некорректный или слишком большой участок');
 const project=p=>({x:(p.lon-lon)*111320*Math.cos(lat*Math.PI/180),y:-(p.lat-lat)*111320});
 const roads=[],buildings=[];const nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
 for(const e of data.elements){
  if(e.type!=='way')continue;
  const geometry=e.geometry||e.nodes?.map(id=>nodes.get(id)).filter(Boolean);
  if(!geometry||geometry.length<2)continue;
  const points=geometry.map(project);
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1600||Math.abs(p.y)>1600))continue;
  const t=e.tags||{};
  if(t.highway&&!['footway','path','steps','cycleway','pedestrian','construction','proposed'].includes(t.highway)&&t.access!=='private'){
   const lanes=Math.min(6,Math.max(1,parseInt(t.lanes)||2));
   roads.push({points,width:Math.min(24,Math.max(3,parseFloat(t.width)||lanes*3.4)),name:t.name||'Улица без названия',oneway:t.oneway==='yes'||t.oneway==='1',reverse:t.oneway==='-1'});
  }
  if((t.building||t['building:part'])&&points.length>=4)buildings.push({points,height:Math.min(450,Math.max(3,parseFloat(t.height)||(parseInt(t['building:levels'])||3)*3.2))});
 }
 if(!roads.length)throw Error('В этом участке нет доступных автомобильных дорог. Выберите другую точку.');
 const segments=roads.flatMap(r=>r.points.slice(1).map((p,i)=>({a:r.points[i],b:p,r}))).filter(s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)>18);
 segments.sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2,(a.a.y+a.b.y)/2)-Math.hypot((b.a.x+b.b.x)/2,(b.a.y+b.b.y)/2));
 if(!segments.length)throw Error('Не найден подходящий участок для старта');
 const s=segments[0],angle=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)+(s.r.reverse?Math.PI:0);
 const spawn={x:(s.a.x+s.b.x)/2-Math.sin(angle)*s.r.width/4,y:(s.a.y+s.b.y)/2+Math.cos(angle)*s.r.width/4,angle};
 return {name:String(name).slice(0,100),lat,lon,roads,buildings,spawn,attribution:'© OpenStreetMap contributors · ODbL',fetchedAt:new Date().toISOString()};
}
export function pointInPolygon(x,y,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}
export async function fetchPlace(lat,lon,name,headers={}){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Введите широту и долготу');
 const d=.0032,dx=d/Math.cos(lat*Math.PI/180);
 const box=[lat-d,lon-dx,lat+d,lon+dx].join(',');
 const query='[out:json][timeout:20];(way["highway"]('+box+');way["building"]('+box+');way["building:part"]('+box+'););out geom;';
 const response=await fetch('https://overpass.private.coffee/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),headers,signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Сервис карты недоступен ('+response.status+'). Используйте встроенную Москва-Сити.');
 return parsePlace(await response.json(),lat,lon,name);
}
