import test from 'node:test';import assert from 'node:assert/strict';import {parsePlace,pointInPolygon} from '../extension/places.js';
const data={elements:[{type:'way',tags:{highway:'residential',name:'Test'},geometry:[{lat:55,lon:37},{lat:55,lon:37.002}]},{type:'way',tags:{building:'yes'},geometry:[{lat:55.001,lon:37},{lat:55.001,lon:37.001},{lat:55.002,lon:37.001},{lat:55.001,lon:37}]}]};
test('OSM coordinates become local roads with right-hand spawn and buildings',()=>{const p=parsePlace(data,55,37,'Test');assert.equal(p.roads.length,1);assert.equal(p.buildings.length,1);assert.ok(p.spawn.y>0);assert.equal(p.spawn.angle,0);assert.ok(p.roads[0].points[1].x>120&&p.roads[0].points[1].x<130);});
test('invalid or empty area is rejected instead of starting off road',()=>{assert.throws(()=>parsePlace(data,NaN,37));assert.throws(()=>parsePlace({elements:[]},55,37));});
test('building contact respects polygon rather than bounding rectangle',()=>{const p=[{x:0,y:0},{x:10,y:0},{x:0,y:10}];assert.ok(pointInPolygon(2,2,p));assert.equal(pointInPolygon(9,9,p),false);});

test('spawn skips a segment whose lane is inside a building',()=>{
 const road=lat=>({type:'way',tags:{highway:'residential'},geometry:[{lat,lon:-.0002},{lat,lon:.0002}]});
 const building={type:'way',tags:{building:'yes'},geometry:[{lat:-.00005,lon:-.00005},{lat:-.00005,lon:.00005},{lat:.00005,lon:.00005},{lat:.00005,lon:-.00005},{lat:-.00005,lon:-.00005}]};
 const p=parsePlace({elements:[road(0),road(.0003),building]},0,0);
 assert.ok(p.spawn.y<-20);
});
