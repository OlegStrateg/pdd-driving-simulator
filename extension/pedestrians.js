import {corners} from './car.js';
// Shared geometry for rules and both renderers. Units are scene pixels, not legal distances.
export function pedestrianMustYield(car,pedestrian) {
 const ys=corners(car).map(p=>p.y);
 return pedestrian.active && pedestrian.y>=1040 && pedestrian.y<=1200
  && pedestrian.y<=Math.max(...ys)+8 && Math.min(...ys)<1200 && Math.max(...ys)>1040;
}
export function crossesOccupiedZebra(previous,car,pedestrian) {
 if(!pedestrianMustYield(car,pedestrian))return false;
 if(Math.hypot(car.x-previous.x,car.y-previous.y)<.0001)return false;
 const body=[...corners(previous),...corners(car)];
 return Math.min(...body.map(p=>p.x))<825 && Math.max(...body.map(p=>p.x))>=775;
}
