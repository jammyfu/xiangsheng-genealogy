import { expect, it } from 'vitest';
import { buildAtlas } from './atlas';
import { loadPeopleFromDisk,loadEdgesFromDisk } from './loadCatalog.node';
import { nameNebulaGraph,nameNebulaPositions,positionNameNebula } from './name-nebula';
import { forceTreeData } from './force-tree';
import { layoutNameCloudLabels } from './name-cloud-labels';
const people=loadPeopleFromDisk(),edges=loadEdgesFromDisk();
const full=buildAtlas({people,edges,selectedId:'tang-jiezhong',mode:'tree',showAll:true});
it('uses each real person once without inventing context relationships',()=>{
 const graph=buildAtlas({people,edges,selectedId:'tang-jiezhong',mode:'tree'});
 const cloud=nameNebulaGraph(graph,full);
 expect(cloud.nodes).toHaveLength(people.length);
 expect(new Set(cloud.nodes.map(n=>n.person.id)).size).toBe(people.length);
 expect(cloud.edges).toEqual(graph.edges);
 expect(cloud.nodes.filter(n=>n.selected).map(n=>n.person.id)).toEqual(['tang-jiezhong']);
});
it('keeps family positions stable, gives context depth and frees the newly selected lineage',()=>{
 const positions=nameNebulaPositions(people,edges);
 expect(positions).toEqual(nameNebulaPositions([...people].reverse(),edges));
 expect(Math.max(...[...positions.values()].map(p=>p.z))-Math.min(...[...positions.values()].map(p=>p.z))).toBeGreaterThan(300);
 const cache=new Map(),graph=buildAtlas({people,edges,selectedId:'tang-jiezhong',mode:'tree'});
 const data=forceTreeData(nameNebulaGraph(graph,full),cache);positionNameNebula(data.nodes,positions);
 const context=data.nodes.find(n=>!n.related)!;
 expect(context.fz).toBe(context.depthTarget);expect(context.fy).toBeDefined();
 const next=forceTreeData(nameNebulaGraph(buildAtlas({people,edges,selectedId:context.id,mode:'tree'}),full),cache);positionNameNebula(next.nodes,positions);
 expect(next.nodes.find(n=>n.id===context.id)?.fz).toBeUndefined();
});
it('places more than eighteen context names locally without overlaps or control collisions',()=>{
 const labels=Array.from({length:180},(_,i)=>({id:String(i),x:50+i%18*48,y:100+Math.floor(i/18)*25,width:38,height:14,priority:1}));
 const obstacle={x:0,y:0,width:200,height:80};
 const placed=layoutNameCloudLabels(labels,1000,700,[obstacle]);expect(placed).toHaveLength(180);
 for(const a of placed)for(const b of placed)if(a.id!==b.id)expect(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y).toBe(false);
});

it('retains the current name at the viewport edge during close inspection',()=>{
 const placed=layoutNameCloudLabels([{id:'current',x:1300,y:900,width:70,height:29,priority:100}],1000,700,[{x:0,y:630,width:1000,height:70}]);
 expect(placed).toHaveLength(1);expect(placed[0].x+placed[0].width).toBeLessThan(1000);expect(placed[0].y+placed[0].height).toBeLessThan(630);expect(placed[0].anchorX).toBe(1335);
});
