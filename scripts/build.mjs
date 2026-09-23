import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {parsePlace} from '../extension/places.js';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve('extension'),out=path.resolve('dist/extension');
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
if(manifest.manifest_version!==3)throw Error('Manifest V3 required');
if(manifest.permissions||JSON.stringify(manifest.host_permissions)!==JSON.stringify(['https://overpass.private.coffee/*']))throw Error('Unexpected permissions');
await mkdir(out,{recursive:true});await cp(root,out,{recursive:true});
await mkdir(path.join(out,'vendor'),{recursive:true});await mkdir(path.join(out,'assets'),{recursive:true});
for(const [src,dest] of [['babylonjs/babylon.js','babylon.js'],['babylonjs-loaders/babylonjs.loaders.min.js','loaders.js'],['earcut/dist/earcut.min.js','earcut.js']])await cp('node_modules/'+src,path.join(out,'vendor',dest));
const sources=[
 ['car.glb','https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/CarConcept/glTF-Binary/CarConcept.glb'],
 ['car-LICENSE.md','https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/CarConcept/LICENSE.md'],
 ['asphalt.jpg','https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_diff_1k.jpg'],
 ['sky.hdr','https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_06_puresky_1k.hdr']
];
const receipt=[];
for(const [name,url] of sources){
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('Asset '+name+': HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<100)throw Error('Empty asset '+name);
 await writeFile(path.join(out,'assets',name),bytes);
 receipt.push({name,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(out,'assets','sources.json'),JSON.stringify(receipt,null,2));
await cp('node_modules/babylonjs/license.md',path.join(out,'vendor','Babylon-LICENSE.md'));
await cp('node_modules/earcut/LICENSE',path.join(out,'vendor','Earcut-LICENSE'));
console.log('BUILD PASS: bundled WebGL engine, GLB model and local textures',JSON.stringify(receipt));


await mkdir('dist/map-source',{recursive:true});
const mapUrl='https://download.bbbike.org/osm/bbbike/Moscow/Moscow.osm.pbf';
const mapResponse=await fetch(mapUrl,{headers:{'User-Agent':'pdd-driving-simulator/0.3 (https://github.com/OlegStrateg/pdd-driving-simulator)'},signal:AbortSignal.timeout(120000)});
if(!mapResponse.ok)throw Error('Moscow extract HTTP '+mapResponse.status);
await writeFile('dist/map-source/moscow.pbf',Buffer.from(await mapResponse.arrayBuffer()));
execFileSync('osmium',['extract','-b','37.5333,55.7466,37.5447,55.7530','dist/map-source/moscow.pbf','-o','dist/map-source/city.osm','--overwrite']);
execFileSync('python3',['scripts/osm-json.py','dist/map-source/city.osm','dist/map-source/city.json'],{stdio:'inherit'});
const city=parsePlace(JSON.parse(await readFile('dist/map-source/city.json','utf8')),55.7498,37.5390,'Москва-Сити');
city.source=mapUrl;
await writeFile(path.join(out,'assets','moscow-city.json'),JSON.stringify(city));
console.log('MOSCOW CITY PACKAGE PASS',JSON.stringify({roads:city.roads.length,buildings:city.buildings.length,fetchedAt:city.fetchedAt,attribution:city.attribution,source:mapUrl}));
