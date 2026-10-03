import json,pathlib,csv,collections,subprocess,tarfile,io
R=pathlib.Path(__file__).resolve().parents[2];O=pathlib.Path(__file__).parent
base=json.load(open(O/'baseline-metrics.json'));old={p['id']:p for p in base['people']}
ppl={p['id']:p for f in (R/'data/people').glob('*.json') if (p:=json.load(open(f)))}
es=json.load(open(R/'data/edges.json'))['edges'];sources=json.load(open(R/'data/sources.json'))['sources'];use=[e for e in es if not e.get('disputed') and e['id'] not in base['summary']['additional_exclusions']];ch=collections.defaultdict(set)
for e in use:ch[e['from']].add(e['to'])
def desc(id):
 seen=set();queue=list(ch[id])
 while queue:
  i=queue.pop()
  if i in seen:continue
  seen.add(i);queue.extend(ch[i])
 return seen
ids=['hou-yichen','li-shouzeng','yang-haiquan','shi-shengjie','su-wenmao','tian-lihe','tang-jiezhong','yin-xiaosheng','chang-baofeng','wei-wenliang','chen-yuting','huang-junying']
rows=[]
for id in ids:
 b=old.get(id,{});rows.append(dict(id=id,name=ppl[id]['name'],before_direct=b.get('direct',0),after_direct=len(ch[id]),before_descendants=b.get('descendants',0),after_descendants=len(desc(id))))
with open(O/'branch-before-after.csv','w') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
with open(O/'new-evidence.csv','w') as f:
 entries=json.load(open(O/'implementation-ledger.json'));w=csv.DictWriter(f,fieldnames=list(entries[0]));w.writeheader();w.writerows(entries)
snap=tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','892c74a','data'],cwd=R)));oldids={json.load(snap.extractfile(m))['id'] for m in snap.getmembers() if m.name.startswith('data/people/') and m.name.endswith('.json')}
newpeople=[p for id,p in ppl.items() if id not in oldids]
with open(O/'new-people.csv','w') as f:
 w=csv.DictWriter(f,fieldnames=['id','name','sources']);w.writeheader();w.writerows(dict(id=p['id'],name=p['name'],sources=';'.join(p['sources'])) for p in sorted(newpeople,key=lambda p:p['id']))
summary=dict(people=len(ppl),edges=len(es),sources=len(sources),new_people=len(newpeople),new_edges=len(es)-384,analysis_edges=len(use),seed_only_edges=sum(e['sources']==['src-wiki-lineage'] for e in use),disputed_edges=sum(bool(e.get('disputed')) for e in es))
(O/'after-metrics.json').write_text(json.dumps(dict(summary=summary,branches=rows),ensure_ascii=False,indent=2)+'\n');print(json.dumps(dict(summary=summary,branches=rows),ensure_ascii=False,indent=2))
