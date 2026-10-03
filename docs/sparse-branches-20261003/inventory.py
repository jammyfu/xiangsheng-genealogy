"""Reproduce coverage at immutable baseline. Counts describe catalog coverage, not reality."""
import json, pathlib, collections, csv, subprocess, tarfile, io
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
snapshot = tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git', 'archive', '892c74a', 'data'], cwd=ROOT)))
people = {}
for member in snapshot.getmembers():
 if member.name.startswith('data/people/') and member.name.endswith('.json'):
  p = json.load(snapshot.extractfile(member)); people[p['id']] = p
edges = json.load(snapshot.extractfile('data/edges.json'))['edges']
EXCLUSIONS = {
 'cao-dekui--gao-fengshan': '数来宝/快板技艺关系，非相声本师边',
 'li-shaojie--jin-fei': '快板关系，不代替相声本师',
 'wang-fengshan--ma-liujia': '来源明确王派快板，曲种未分',
 'guo-degang--yu-yunting': '文字明确仍待逐人核验',
}
usable = [e for e in edges if not e.get('disputed') and e['id'] not in EXCLUSIONS]
children, parents = collections.defaultdict(set), collections.defaultdict(set)
for e in usable:
 assert e['from'] in people and e['to'] in people
 children[e['from']].add(e['to']); parents[e['to']].add(e['from'])
def descendants(id):
 seen, queue = set(), list(children[id])
 while queue:
  child = queue.pop()
  assert child != id, 'cycle'
  if child in seen: continue
  seen.add(child); queue.extend(children[child])
 return seen
rows=[]
for id,p in sorted(people.items()):
 ds=descendants(id); branch_edges=[e for e in usable if e['from'] in ds|{id}]
 rows.append(dict(id=id,name=p['name'],generationIndex=p['generationIndex'],direct=len(children[id]),descendants=len(ds),inclusive=len(ds)+1,root=not parents[id],isolated=not parents[id] and not children[id],seed_only_edges=sum(set(e['sources'])=={'src-wiki-lineage'} for e in branch_edges),branch_edges=len(branch_edges),direct_names=';'.join(people[i]['name'] for i in sorted(children[id])),descendant_ids=';'.join(sorted(ds))))
summary=dict(baseline='892c74a',people=len(people),all_edges=len(edges),disputed_edges=sum(bool(e.get('disputed')) for e in edges),additional_exclusions=EXCLUSIONS,analysis_edges=len(usable),seed_only_edges=sum(set(e['sources'])=={'src-wiki-lineage'} for e in usable),nonseed_edges=sum(set(e['sources'])!={'src-wiki-lineage'} for e in usable),roots=sum(r['root'] for r in rows),isolated=sum(r['isolated'] for r in rows),caveat='analysis_edges are non-disputed crosstalk candidate edges, not independently verified formal apprenticeship; seed-only edges are separated.')
assert len(rows)==403 and len(edges)==384
(OUT/'baseline-metrics.json').write_text(json.dumps(dict(summary=summary,people=rows),ensure_ascii=False,indent=2)+'\n')
with (OUT/'branch-coverage.csv').open('w') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0])); writer.writeheader();writer.writerows(rows)
roots=[r for r in rows if r['root']]
with (OUT/'roots-and-gaps.csv').open('w') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0])); writer.writeheader();writer.writerows(roots)
print(json.dumps(summary,ensure_ascii=False,indent=2))
