import { useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { Person } from "../types";
import { disciplesOf, mentorsOf, edges, peopleById } from "../lib/catalog";
import { eventsForPerson } from "../lib/events";
import { EventList } from "./EventList";
import { SourceLinks } from "./SourceLinks";
import { usePageMotion } from "../lib/useStudioMotion";

export function lifespan(person: Person) {
  return person.birthYear
    ? `${person.birthYear} — ${person.deathYear ?? " "}`
    : (person.floruit ?? "生卒年待考");
}
const tabs = ["小传", "师承", "作品", "事件", "出处"] as const;
export function PersonBook({
  person,
  onSelect,
  onLocate,
}: {
  person: Person;
  onSelect: (id: string) => void;
  onLocate: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("小传");
  const tabId = useId();
  const pageRef = useRef<HTMLDivElement>(null);
  usePageMotion(pageRef, tab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mentors = mentorsOf(person.id),
    disciples = disciplesOf(person.id),
    items = eventsForPerson(person.id);
  const related = edges.filter(
    (e) => e.from === person.id || e.to === person.id,
  );
  return (
    <section className="book-scene" aria-label={`${person.name}人物书笺`}>
      <div className="book-spread">
        <div className="book-identity">
          <p className="book-kicker">
            人物 · {person.generation ? `${person.generation}字辈` : "字辈待考"}
          </p>
          <span className="book-watermark" aria-hidden="true">
            {person.generation ?? "谱"}
          </span>
          <h1>{person.name}</h1>
          <span className="generation-seal">{person.generation ?? "谱"}</span>
          <p className="book-years">{lifespan(person)}</p>
          <p>{person.school}</p>
          {person.originalGeneration ? (
            <p className="lineage-adjustment">
              原始{person.originalGeneration}字辈 · 通行{person.generation}字辈
            </p>
          ) : null}
          <span className="image-caption">相声意象 · 折扇与醒木</span>
        </div>
        <div className="book-content">
          <div role="tablist" aria-label="人物资料" className="book-tabs">
            {tabs.map((t, index) => (
              <button
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`${tabId}-${index}`}
                role="tab"
                aria-selected={tab === t}
                aria-controls={`${tabId}-content`}
                tabIndex={tab === t ? 0 : -1}
                key={t}
                onClick={() => setTab(t)}
                onKeyDown={(event) => {
                  let next: number;
                  switch (event.key) {
                    case "ArrowRight":
                      next = (index + 1) % tabs.length;
                      break;
                    case "ArrowLeft":
                      next = (index - 1 + tabs.length) % tabs.length;
                      break;
                    case "Home":
                      next = 0;
                      break;
                    case "End":
                      next = tabs.length - 1;
                      break;
                    default:
                      return;
                  }
                  event.preventDefault();
                  setTab(tabs[next]);
                  tabRefs.current[next]?.focus();
                }}
              >
                {t}
                {t === "事件" && items.length > 0 && <sup>{items.length}</sup>}
              </button>
            ))}
          </div>
          <div
            className="book-copy"
            ref={pageRef}
            id={`${tabId}-content`}
            role="tabpanel"
            aria-labelledby={`${tabId}-${tabs.indexOf(tab)}`}
            tabIndex={0}
          >
            {tab === "小传" && (
              <>
                <p className="eyebrow">人物小传</p>
                <h2>声留人间</h2>
                <p className="biography">{person.bio}</p>
                {person.generationNote ? (
                  <aside className="dispute-note lineage-adjustment-note">
                    <strong>字辈调整</strong>
                    <p>{person.generationNote}</p>
                  </aside>
                ) : null}
                {person.aliases?.length ? (
                  <p className="muted">亦名：{person.aliases.join("、")}</p>
                ) : null}
                <h3>师承脉络</h3>
                <div className="lineage-breadcrumb">
                  {mentors.slice(0, 1).map((p) => (
                    <button key={p.id} onClick={() => onSelect(p.id)}>
                      {p.name}
                      <ArrowRight size={20} />
                    </button>
                  ))}
                  <span>{person.name}</span>
                  {disciples.slice(0, 1).map((p) => (
                    <button key={p.id} onClick={() => onSelect(p.id)}>
                      <ArrowRight size={20} />
                      {p.name}
                    </button>
                  ))}
                </div>
                <h3>代表作品</h3>
                <Works titles={person.works} />
                {items.length > 0 && (
                  <button
                    className="inline-link"
                    onClick={() => setTab("事件")}
                  >
                    查看 {items.length} 条事件与核验记录
                    <ArrowRight />
                  </button>
                )}
              </>
            )}
            {tab === "师承" && (
              <>
                <h2>师门有来处</h2>
                <p className="muted">
                  历史拜师与组织任职分开记录。退出、除名等后续变动见「事件」。
                </p>
                {person.generationNote ? (
                  <div className="dispute-note lineage-adjustment-note">
                    <strong>字辈调整不改变师承</strong>
                    <p>{person.generationNote}</p>
                  </div>
                ) : null}
                <h3>师承</h3>
                <PersonButtons list={mentors} onSelect={onSelect} />
                <h3>传人</h3>
                <PersonButtons list={disciples} onSelect={onSelect} />
                {related
                  .filter((e) => e.disputed || e.note)
                  .map((e) => (
                    <div className="dispute-note" key={e.id}>
                      <strong>
                        {peopleById[e.from]?.name ?? e.from} →{" "}
                        {peopleById[e.to]?.name ?? e.to}：
                        {e.disputed ? "此条师承存在异说" : "师承说明"}
                      </strong>
                      <p>
                        {e.note ?? "已有谱表标记异说，具体依据待进一步核验。"}
                      </p>
                      <SourceLinks ids={e.sources} />
                    </div>
                  ))}
                {person.notes?.map((n, i) => (
                  <p className="editor-note" key={i}>
                    {n}
                  </p>
                ))}
              </>
            )}
            {tab === "作品" && (
              <>
                <h2>一席百味</h2>
                <p className="muted">
                  目前收录作品名称，版本与演出资料逐步补充。
                </p>
                <Works titles={person.works} />
              </>
            )}
            {tab === "事件" && (
              <>
                <h2>事有据，言有源</h2>
                <p className="muted">
                  区分已报道事实、当事人陈述与尚有分歧的内容。
                </p>
                <EventList items={items} />
              </>
            )}
            {tab === "出处" && (
              <>
                <h2>循迹考据</h2>
                <p className="muted">
                  人物原有资料与新核验事件分别注明来源。引用条目不代表已完成全部史实核验。
                </p>
                <SourceLinks ids={person.sources} />
                {items.length > 0 && (
                  <>
                    <h3>事件依据</h3>
                    <SourceLinks ids={items.flatMap((e) => e.sources)} />
                  </>
                )}
              </>
            )}
          </div>
          <div className="book-actions">
            <button className="inline-link" onClick={onLocate}>
              在世代谱系中定位
              <ArrowRight size={21} />
            </button>
            <button onClick={() => setTab("出处")}>查看出处</button>
          </div>
        </div>
      </div>
      <nav className="book-pagination" aria-label="沿师承翻阅">
        <button
          disabled={!mentors[0]}
          onClick={() => mentors[0] && onSelect(mentors[0].id)}
        >
          <ArrowLeft size={21} />
          {mentors[0] ? `师傅：${mentors[0].name}` : "上溯待考"}
        </button>
        <span>翻阅顺序：沿师承</span>
        {disciples.length ? (
          <label>
            弟子
            <select
              aria-label="选择弟子翻阅"
              value=""
              onChange={(e) => e.target.value && onSelect(e.target.value)}
            >
              <option value="">选择传人</option>
              {disciples.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ArrowRight size={21} />
          </label>
        ) : (
          <span>传人资料待补</span>
        )}
      </nav>
    </section>
  );
}
function Works({ titles }: { titles: string[] }) {
  return titles.length ? (
    <ol className="works-list">
      {titles.map((t, i) => (
        <li key={t}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          {t}
        </li>
      ))}
    </ol>
  ) : (
    <p className="muted">代表作品资料待补。</p>
  );
}
function PersonButtons({
  list,
  onSelect,
}: {
  list: Person[];
  onSelect: (id: string) => void;
}) {
  return list.length ? (
    <div className="person-links">
      {list.map((p) => (
        <button key={p.id} onClick={() => onSelect(p.id)}>
          {p.name}
          <ArrowRight size={16} />
        </button>
      ))}
    </div>
  ) : (
    <p className="muted">暂无可列资料。</p>
  );
}
