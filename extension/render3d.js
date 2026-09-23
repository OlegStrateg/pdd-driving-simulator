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
 constructor(canvas){
  const B=globalThis.BABYLON;this.B=B;this.canvas=canvas;this.angle=0;
  this.surface=document.createElement('canvas');this.surface.id='world3d';canvas.after(this.surface);
  this.engine=new B.Engine(this.surface,true,{preserveDrawingBuffer:true,stencil:true,disableWebGL2Support:false});
  this.surface.dataset.renderer=this.engine.getGlInfo().renderer;this.software=/swiftshader|llvmpipe/i.test(this.surface.dataset.renderer);this.renderElapsed=0;
  this.engine.setHardwareScalingLevel(this.software?1.5:Math.max(1,(devicePixelRatio||1)/1.25));
  this.scene=new B.Scene(this.engine);this.scene.useRightHandedSystem=true;this.scene.clearColor=new B.Color4(.58,.72,.82,1);
  this.scene.fogMode=B.Scene.FOGMODE_EXP2;this.scene.fogDensity=.00028;this.scene.fogColor=new B.Color3(.66,.75,.79);
  this.camera=new B.FreeCamera('chase',new B.Vector3(400,65,1160),this.scene);
  this.camera.minZ=1;this.camera.maxZ=12000;this.camera.fov=.85;
  this.sun=new B.DirectionalLight('sun',new B.Vector3(-.5,-1,.35),this.scene);this.sun.intensity=2.4;
  this.sun.diffuse=new B.Color3(1,.91,.78);this.sun.shadowMinZ=1;this.sun.shadowMaxZ=5000;
  new B.HemisphericLight('ambient',new B.Vector3(0,1,0),this.scene).intensity=.65;
  this.shadow=new B.ShadowGenerator(this.software?1024:2048,this.sun);this.shadow.usePercentageCloserFiltering=true;this.shadow.bias=.0002;this.shadow.normalBias=.15;
  this.scene.environmentTexture=new B.HDRCubeTexture('assets/sky.hdr',this.scene,128,false,true,false,true);
  this.scene.environmentIntensity=.7;
  this.scene.createDefaultSkybox(this.scene.environmentTexture,true,11000,.6);
  this.scene.imageProcessingConfiguration.toneMappingEnabled=true;this.scene.imageProcessingConfiguration.exposure=1.1;
  this.materials=new Map();this.city=[];this.buildCity();
  this.player=new B.TransformNode('player',this.scene);this.other=new B.TransformNode('traffic',this.scene);
  this.person=this.makePerson();
  this.marker=B.MeshBuilder.CreateTorus('next waypoint',{diameter:32,thickness:2,tessellation:24},this.scene);this.marker.material=this.material('waypoint','#e1f58d');this.marker.material.emissiveColor=new B.Color3(.4,.55,.1);
  this.ready=this.loadCar().catch(e=>{this.surface.dataset.error=e.message;throw e;});
  this.ready.catch(()=>{});
  this.resize=new ResizeObserver(()=>this.engine.resize());this.resize.observe(canvas.parentElement);
 }
 material(name,color,metal=0,rough=.85){
  if(this.materials.has(name))return this.materials.get(name);
  const m=new this.B.PBRMaterial(name,this.scene);m.albedoColor=this.B.Color3.FromHexString(color);m.metallic=metal;m.roughness=rough;
  this.materials.set(name,m);return m;
 }
 box(x,z,y,w,d,h,mat,parent=null){
  const m=this.B.MeshBuilder.CreateBox('detail',{width:w,depth:d,height:h},this.scene);m.position.set(x,y+h/2,z);m.material=mat;m.receiveShadows=true;
  if(parent)m.parent=parent;else this.city.push(m);return m;
 }
 road(a,b,width){
  const len=Math.hypot(b.x-a.x,b.y-a.y);if(len<.01)return;
  const x=(a.x+b.x)/2,z=(a.y+b.y)/2,angle=-Math.atan2(b.y-a.y,b.x-a.x);
  this.box(x,z,-1,len+width,width+20,2,this.material('sidewalk','#aaa99e')).rotation.y=angle;
  const m=this.box(x,z,1,len+width*.7,width,.6,this.material('asphalt','#969696'));m.rotation.y=angle;
  // World-scale repeat avoids stretching an asphalt photo along the whole street.
  const uv=m.getVerticesData(this.B.VertexBuffer.UVKind);
  for(let i=0;i<uv.length;i+=2){uv[i]*=len/32;uv[i+1]*=width/32;}
  m.setVerticesData(this.B.VertexBuffer.UVKind,uv);
 }
 buildCity(place=null){
  for(const m of this.city)m.dispose();this.city=[];this.place=place;
  const asphalt=this.material('asphalt','#969696');
  if(!asphalt.albedoTexture)asphalt.albedoTexture=new this.B.Texture('assets/asphalt.jpg',this.scene);
  const grass=this.material('grass','#6e7950'),paint=this.material('paint','#eee9d4');
  this.box(place?0:1000,place?0:750,-3,16000,16000,1,grass);
  if(place){
   for(const r of place.roads)for(let i=1;i<r.points.length;i++)this.road({x:r.points[i-1].x*10,y:r.points[i-1].y*10},{x:r.points[i].x*10,y:r.points[i].y*10},r.width*10);
   for(const [i,b] of place.buildings.entries())this.footprint(b,i);
  }else{
   for(const r of ROADS)this.road(r.w>r.h?{x:r.x+80,y:r.y+80}:{x:r.x+80,y:r.y+80},r.w>r.h?{x:r.x+r.w-80,y:r.y+80}:{x:r.x+80,y:r.y+r.h-80},160);
   // Explicit centre lines leave junctions clear.
   for(const y of [400,1120])for(const [a,b] of [[100,318],[482,1118],[1282,1518],[1682,2000]])this.box((a+b)/2,y,2,b-a,2,.15,paint);
   for(const x of [400,1200,1600])for(const [a,b] of [[160,318],[482,1038],[1202,1340]])this.box(x,(a+b)/2,2,2,b-a,.15,paint);
   for(let y=1048;y<1194;y+=22)this.box(800,y+6,2.2,50,12,.15,paint);
   for(let x=1528;x<1672;x+=22)this.box(x+6,752,2.2,12,45,.15,paint);
   this.box(1500,1160,2.3,4,76,.2,paint);this.box(1640,800,2.3,76,4,.2,paint);
   this.box(PARK.x+PARK.w/2,PARK.y+PARK.h/2,1.9,PARK.w,PARK.h,.2,this.material('parking','#73826b'));
   SOLIDS.forEach((r,i)=>this.building(r,i));
   for(const [x,z] of [[250,550],[250,720],[250,940],[530,495],[745,490],[1000,505],[510,790],[1050,960],[540,975],[850,975],[1420,970],[1460,495],[1740,850],[1850,880],[580,240],[890,230],[1020,235],[1780,265],[650,745],[745,770],[560,1250],[680,1250],[1080,1295],[1360,1250],[1470,1270],[1740,1250]])this.tree(x,z);
   for(const [x,z] of [[695,1223],[1450,1223],[1715,990],[1715,550],[1020,285],[520,285],[285,540],[285,1000]])this.lamp(x,z);
   this.sign(650,1218,'40');this.sign(840,1218,'ПЕШЕХОД');this.sign(1480,1218,'STOP');this.sign(1315,295,'УСТУПИ');this.sign(1045,1260,'P');
   this.lamp(1700,805);
   this.lights=['#ff2929','#ffc52e','#58df80'].map((col,i)=>this.box(1700,800,62-i*9,7,3,7,this.material('light'+i,col)));this.lights.forEach(m=>m.metadata={keep:true});
  }
  // Merge static meshes by material to keep draw calls independent of window count.
  const groups=new Map();for(const m of this.city){if(m.metadata?.keep)continue;const key=m.material.uniqueId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
  const merged=[];for(const meshes of groups.values()){
   const m=this.B.Mesh.MergeMeshes(meshes,true,true,undefined,false,false);
   if(m){m.receiveShadows=true;this.shadow.addShadowCaster(m);m.freezeWorldMatrix();merged.push(m);}
  }
  this.city=[...this.city.filter(m=>m.metadata?.keep),...merged];
 }
 building(r,i){
  const h=[90,130,75,150,112][i%5],mat=this.material('wall'+i%4,['#c4b49f','#abaca6','#be9c81','#c2c4ba'][i%4]);
  this.box(r.x+r.w/2,r.y+r.h/2,0,r.w,r.h,h,mat);
  const ledge=this.material('ledge','#dedad0'),glass=this.material('window','#456271',.65,.23);
  this.box(r.x+r.w/2,r.y+r.h/2,h,r.w+6,r.h+6,4,ledge);
  for(let y=8;y<h-15;y+=27){
   this.box(r.x+r.w/2,r.y+r.h/2,y,r.w+3,r.h+3,1.5,ledge);
   for(let x=r.x+12;x<r.x+r.w-14;x+=24)for(const z of [r.y-1,r.y+r.h+1]){
    this.box(x,z,y+4,14,2,18,ledge);this.box(x,z+(z<r.y?-1.1:1.1),y+6,11,1,14,glass);
   }
   for(let z=r.y+14;z<r.y+r.h-14;z+=24)for(const x of [r.x-1,r.x+r.w+1])this.box(x,z,y+6,1,12,14,glass);
  }
  const door=this.material('door','#263942',.3,.3);this.box(r.x+r.w*.55,r.y+r.h+2,1,18,3,27,door);
  this.box(r.x+r.w*.55,r.y+r.h+10,28,32,23,3,ledge);
  this.box(r.x+r.w*.6,r.y+r.h*.55,h+4,25,22,12,this.material('hvac','#717e80',.5));
 }
 footprint(b,i){
  const B=this.B,points=b.points.slice(0,-1).map(p=>new B.Vector3(p.x*10,0,p.y*10));
  if(points.length<3)return;
  const h=b.height*10,positions=[],indices=[];
  for(let j=0;j<points.length;j++){
   const a=points[j],c=points[(j+1)%points.length],k=positions.length/3;
   positions.push(a.x,0,a.z,c.x,0,c.z,c.x,h,c.z,a.x,h,a.z);indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  // Roof triangulation supports concave footprints.
  const coords=points.flatMap(p=>[p.x,p.z]),tris=globalThis.earcut(coords),base=positions.length/3;
  positions.push(...points.flatMap(p=>[p.x,h,p.z]));for(let j=0;j<tris.length;j+=3)indices.push(base+tris[j+2],base+tris[j+1],base+tris[j]);
  const m=new B.Mesh('OSM building',this.scene),vd=new B.VertexData();vd.positions=positions;vd.indices=indices;vd.normals=[];B.VertexData.ComputeNormals(positions,indices,vd.normals);vd.applyToMesh(m);
  m.material=this.material('osmWall'+i%3,['#b7ac9a','#c5b9aa','#abaeaa'][i%3]);m.material.backFaceCulling=false;this.city.push(m);
 }
 tree(x,z){
  const B=this.B;this.box(x,z,0,5,5,28,this.material('bark','#63543e'));
  for(let i=0;i<3;i++){const m=B.MeshBuilder.CreateSphere('crown',{diameter:40-i*4,segments:5},this.scene);m.position.set(x+(i-1)*10,35+i*11,z+(i%2)*9);m.scaling.y=1.2;m.material=this.material('leaf'+i,['#405934','#516a39','#657744'][i]);this.city.push(m);}
 }
 lamp(x,z){const metal=this.material('metal','#596066',.7,.4);this.box(x,z,0,2,2,75,metal);this.box(x,z-8,75,2,20,2,metal);this.box(x,z-17,73,8,12,2,this.material('lamp','#f9edd0'));}
 sign(x,z,text){
  const B=this.B;this.box(x,z,0,2,2,46,this.material('pole','#727c7c',.6));
  const tex=new B.DynamicTexture('sign '+text,256,this.scene,false),c=tex.getContext();c.clearRect(0,0,256,256);
  c.fillStyle=text==='STOP'?'#c83329':text==='P'||text==='ПЕШЕХОД'?'#176cbd':'#fff';c.fillRect(4,4,248,248);c.strokeStyle=text==='40'||text==='УСТУПИ'?'#cf312c':'#fff';c.lineWidth=18;c.strokeRect(13,13,230,230);
  c.fillStyle=text==='40'?'#111':'#fff';c.textAlign='center';c.font='bold '+(text==='ПЕШЕХОД'?85:100)+'px Arial';c.fillText(text==='ПЕШЕХОД'?'↟':text==='УСТУПИ'?'▽':text,128,166);tex.update();
  const mat=new B.StandardMaterial('sign',this.scene);mat.diffuseTexture=tex;mat.backFaceCulling=false;mat.emissiveColor=new B.Color3(.15,.15,.15);
  const m=B.MeshBuilder.CreatePlane('sign',{size:23,sideOrientation:B.Mesh.DOUBLESIDE},this.scene);m.position.set(x,57,z);m.rotation.y=-Math.PI/2;m.material=mat;this.city.push(m);
 }
 makePerson(){
  const B=this.B,p=new B.TransformNode('pedestrian',this.scene);
  const body=this.box(0,0,11,8,5,13,this.material('jacket','#c67439'),p);
  const head=B.MeshBuilder.CreateSphere('head',{diameter:6,segments:8},this.scene);head.parent=p;head.position.y=28;head.material=this.material('skin','#d6aa85');
  this.legs=[-3,3].map(x=>this.box(x,0,1,3,4,11,this.material('trousers','#344456'),p));this.shadow.addShadowCaster(body,true);return p;
 }
 async loadCar(){
  const B=this.B,r=await B.SceneLoader.ImportMeshAsync('','assets/','car.glb',this.scene);
  const root=r.meshes[0];root.computeWorldMatrix(true);const bounds=root.getHierarchyBoundingVectors(true);
  const size=bounds.max.subtract(bounds.min);const length=Math.max(size.x,size.z),scale=44/length;
  const holder=new B.TransformNode('car-model',this.scene);root.parent=holder;
  // glTF sample's nose points along +Z; convert to the simulation's +X.
  holder.rotation.y=Math.PI/2;holder.scaling.setAll(scale);
  root.position.y-=bounds.min.y;root.position.x-=(bounds.max.x+bounds.min.x)/2;root.position.z-=(bounds.max.z+bounds.min.z)/2;
  holder.parent=this.player;
  const second=holder.clone('traffic-model',this.other);second.setEnabled(true);
  for(const m of r.meshes){m.receiveShadows=true;this.shadow.addShadowCaster(m);}
  for(const m of second.getChildMeshes())this.shadow.addShadowCaster(m);
  this.wheelRoll=0;this.wheels=r.transformNodes.filter(n=>/^Wheel(Front|Rear)[LR]$/.test(n.name)).map(n=>({node:n,rotation:n.rotation.clone(),quaternion:n.rotationQuaternion?.clone()}));
  this.surface.dataset.model='CarConcept';this.surface.dataset.ready='true';
 }
 visible(value){this.surface.classList.toggle('hidden',!value);this.canvas.classList.toggle('hidden',value);}
 draw(exam,dt){
  this.visible(true);const B=this.B,c=exam.car;
  this.angle+=Math.atan2(Math.sin(c.angle-this.angle),Math.cos(c.angle-this.angle))*Math.min(1,dt*5);
  this.wheelRoll=(this.wheelRoll||0)+c.speed*dt/3.8;
  for(const w of this.wheels||[]){const base=w.quaternion||B.Quaternion.FromEulerVector(w.rotation);w.node.rotationQuaternion=B.Quaternion.RotationAxis(B.Axis.Z,/Front/.test(w.node.name)?-c.steer:0).multiply(B.Quaternion.RotationAxis(B.Axis.X,this.wheelRoll)).multiply(base);}
  this.player.position.set(c.x,2,c.y);this.player.rotation.y=-c.angle;
  const distance=110+Math.abs(c.speed)*.12,a=this.angle;
  this.camera.position.set(c.x-Math.cos(a)*distance,62,c.y-Math.sin(a)*distance);
  this.camera.setTarget(new B.Vector3(c.x+Math.cos(a)*100,15,c.y+Math.sin(a)*100));
  this.sun.position.set(c.x+400,1200,c.y-700);
  const t=trafficAt(exam.time),p=pedestrianAt(exam.time);
  this.other.setEnabled(!this.place&&t.active);this.other.position.set(t.x,2,t.y);this.other.rotation.y=-t.angle;
  this.person.setEnabled(!this.place&&p.active);this.person.position.set(p.x,2,p.y);
  this.legs.forEach((m,i)=>m.rotation.x=Math.sin(exam.time*8+i*Math.PI)*.4);
  if(this.lights&&!this.place)this.lights.forEach((m,i)=>m.material.emissiveColor=B.Color3.FromHexString(['#ff2929','#ffc52e','#58df80'][i]).scale(lightAt(exam.time)===['red','yellow','green'][i]?1:.03));
  this.marker.setEnabled(!this.place);const next=ROUTE[exam.stage];this.marker.position.set(next.x,3,next.y);
  this.canvas.dataset.rendered='3d';this.renderElapsed+=dt;if(this.software&&this.renderElapsed<.1)return;this.renderElapsed=0;
  this.engine.resize();this.scene.render();this.surface.dataset.fps=String(Math.round(this.engine.getFps()));
 }
}
