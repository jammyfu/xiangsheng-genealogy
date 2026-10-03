import type { TreeLabelCandidate, TreeLabelPlacement, LabelObstacle } from './tree-label-layout';
const overlaps = (a:LabelObstacle,b:LabelObstacle) => a.x < b.x+b.width+2 && a.x+a.width+2 > b.x && a.y < b.y+b.height+2 && a.y+a.height+2 > b.y;
/** Local spatial buckets avoid scanning every existing name on every camera frame. */
export function layoutNameCloudLabels(candidates:TreeLabelCandidate[],width:number,height:number,obstacles:LabelObstacle[]) {
  const cells=new Map<string,LabelObstacle[]>(),placed:TreeLabelPlacement[]=[];
  const keys=(rect:LabelObstacle)=>{
    const result:string[]=[];
    for(let x=Math.floor((rect.x-2)/32);x<=Math.floor((rect.x+rect.width+2)/32);x++)
      for(let y=Math.floor((rect.y-2)/32);y<=Math.floor((rect.y+rect.height+2)/32);y++)result.push(`${x}:${y}`);
    return result;
  };
  const occupy=(rect:LabelObstacle)=>{for(const key of keys(rect)){const cell=cells.get(key)??[];cell.push(rect);cells.set(key,cell);}};
  obstacles.forEach(occupy);
  for(const label of [...candidates].sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id))) {
    const anchorX=label.x+label.width/2,anchorY=label.y+label.height/2;
    // Keep the current person's name reachable when inspecting another part of the cloud.
    const originX=label.priority===100?Math.max(6,Math.min(width-label.width-6,label.x)):label.x;
    const originY=label.priority===100?Math.max(6,Math.min(height-label.height-6,label.y)):label.y;
    let chosen:LabelObstacle|undefined;
    const rings=label.priority>1?24:10;
    for(let ring=0;ring<=rings && !chosen;ring++) {
      const steps=ring?12:1;
      for(let i=0;i<steps;i++) {
        const angle=i/steps*Math.PI*2;
        const rect={x:originX+Math.cos(angle)*ring*7,y:originY+Math.sin(angle)*ring*7,width:label.width,height:label.height};
        if(rect.x<6 || rect.y<6 || rect.x+rect.width>width-6 || rect.y+rect.height>height-6 || keys(rect).some(key=>cells.get(key)?.some(o=>overlaps(rect,o))))continue;
        chosen=rect;break;
      }
    }
    if(chosen) { occupy(chosen);placed.push({...label,...chosen,anchorX,anchorY}); }
  }
  return placed;
}
