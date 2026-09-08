# Contributing

Thank you for helping document xiangsheng lineages.

## Add or correct a person

1. Create `data/people/<id>.json` using `data/schemas/person.schema.json`.
   `id` is lowercase Latin (`hou-baolin`), `name` is the common Chinese name.
2. Add mentor → disciple rows to `data/edges.json`. Every `from` / `to` must
   exist. Mark uncertain rows `"disputed": true` and explain in `note`.
3. Cite at least one record from `data/sources.json`. New sources go in that
   file first.
4. Generation characters are only 德 / 寿 / 宝 / 文 / 明, or `null` for
   generations 1–3 and 9+. Do not invent 喜 / 哈 or later poems.
5. Works are **titles only**. Do not upload recordings.
6. Portraits: `placeholder`, a public-domain file, or an external URL.

```bash
node scripts/emit-seed.mjs   # only if you edit the generator
npm test
npm run build
```

## Scope

This is a research visualization, not a court of seniority. Prefer
published tables over gossip. Keep the ink-wash interface: xuan paper
`#F3EBD9`, ink greys, cinnabar seal `#8B1E1E`. No neon SaaS chrome.

## Language

UI copy is Simplified Chinese. Code identifiers are English. README
keeps a short English GEO blurb so search engines know this is
**Xiangsheng Genealogy** — Chinese crosstalk lineages.
