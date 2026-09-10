import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  MagnifyingGlass,
  CaretDown,
  X,
} from "@phosphor-icons/react";
import { peopleById, searchPeople, mentorsOf } from "../lib/catalog";
import { eventsForPerson } from "../lib/events";
import { readBrowseState, updateBrowseSearch, VIEWS } from "../lib/browsing";
import type { BrowseState, BrowseView } from "../lib/browsing";
import { GENERATIONS } from "../types";
import { AtlasGraph } from "./AtlasGraph";
import { PersonBook, lifespan } from "./PersonBook";
import { TimelineView } from "./TimelineView";
import { EvidencePanel } from "./EvidencePanel";

export function Studio() {
  const { id } = useParams(),
    location = useLocation(),
    navigate = useNavigate();
  const state = readBrowseState(location.search);
  const knownPerson = id !== undefined && Object.hasOwn(peopleById, id);
  const selected = knownPerson ? peopleById[id] : peopleById["hou-baolin"];
  const [graphMode, setGraphMode] = useState<"scroll" | "tree">(
    state.view === "tree" ? "tree" : "scroll",
  );
  useEffect(() => {
    if (state.view === "scroll" || state.view === "tree")
      setGraphMode(state.view);
  }, [state.view]);
  const [searchOpen, setSearchOpen] = useState(false),
    [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState<"people" | "evidence" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null),
    openerRef = useRef<HTMLElement | null>(null);
  const openPanel = (type: "people" | "evidence") => {
    openerRef.current = document.activeElement as HTMLElement;
    setPanel(type);
  };
  const closePanel = () => {
    setPanel(null);
    openerRef.current?.focus();
  };
  useEffect(() => {
    if (!id) navigate(`/p/hou-baolin${location.search}`, { replace: true });
  }, [id, navigate, location.search]);
  useEffect(() => {
    document.title = `${selected.name} · ${VIEWS.find((v) => v.id === state.view)?.label} · 相声家谱`;
  }, [selected.name, state.view]);
  useEffect(() => {
    if (!panel) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [panel]);
  const change = (patch: Partial<BrowseState>) =>
    navigate(
      `/p/${selected.id}?${updateBrowseSearch(location.search, patch)}`,
      { replace: patch.query !== undefined },
    );
  const select = (next: string) => {
    navigate(`/p/${next}${location.search}`);
    setSearchOpen(false);
    setDrawer(false);
  };
  const view = (next: BrowseView) => {
    change({ view: next });
    setDrawer(false);
  };
  const results = searchPeople(state.query).slice(0, 9);
  const graph = state.view === "scroll" || state.view === "tree";
  const mentors = mentorsOf(selected.id),
    personalEvents = eventsForPerson(selected.id);
  return (
    <main className={`ink-app view-${state.view}`}>
      <a className="skip-link" href="#main-content">
        跳到浏览内容
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => {
            navigate("/p/hou-baolin?view=scroll");
            setPanel(null);
          }}
          aria-label="相声家谱首页"
        >
          <img src="/seal.svg" alt="" />
          <span>相声家谱</span>
          <small>XIANGSHENG GENEALOGY</small>
        </button>
        <nav className="global-nav" aria-label="主导航">
          <button
            className={!panel ? "active" : ""}
            onClick={() => {
              closePanel();
              view("scroll");
            }}
          >
            览谱
          </button>
          <button onClick={() => openPanel("people")}>寻人</button>
          <button onClick={() => openPanel("evidence")}>考据</button>
        </nav>
        <div className="search-box">
          <MagnifyingGlass size={23} weight="light" />
          <input
            ref={searchRef}
            aria-label="搜索人物"
            placeholder="搜索姓名或艺名"
            value={state.query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              change({ query: e.target.value });
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)
                return;
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "Enter" && state.query.trim() && results[0])
                select(results[0].id);
            }}
          />
          {state.query && (
            <button aria-label="清除搜索" onClick={() => change({ query: "" })}>
              <X size={15} />
            </button>
          )}
          {searchOpen && state.query && (
            <div className="search-results">
              <p>找到 {searchPeople(state.query).length} 位人物</p>
              {results.map((p) => (
                <button key={p.id} onClick={() => select(p.id)}>
                  <span>{p.name}</span>
                  <small>
                    {p.generation ? `${p.generation}字辈` : "字辈待考"}
                  </small>
                </button>
              ))}
              {!results.length && <p>暂无匹配，试试其他姓名。</p>}
            </div>
          )}
        </div>
      </header>
      <section className="view-bar">
        <p className="view-motto">循一脉，见传承</p>
        <nav aria-label="浏览方式" className="view-tabs">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              aria-current={state.view === v.id ? "page" : undefined}
              onClick={() => view(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <span className="view-note">说学逗唱 · 传承有序</span>
        <p className="current-person">
          当前人物：{selected.name} ·{" "}
          {selected.generation ? `${selected.generation}字辈` : "字辈待考"}
        </p>
      </section>
      {id && !knownPerson && (
        <div className="notice">
          没有找到该人物，已为你打开侯宝林。
          <button onClick={() => openPanel("people")}>查看人物索引</button>
        </div>
      )}
      <div id="main-content" className="main-content">
        <div className="exploration" hidden={!graph}>
          <section className="graph-stage" aria-label="师承浏览">
            <img
              className="landscape-art"
              src="/assets/landscape.webp"
              alt=""
            />
            <div className="graph-heading">
              {state.view === "scroll" && <h1>一脉相承</h1>}
              <label className="path-select">
                <span className="sr-only">选择师承游径</span>
                <select
                  value={selected.id}
                  onChange={(e) => select(e.target.value)}
                >
                  <option value={selected.id}>{selected.name}一脉</option>
                  {[
                    "hou-baolin",
                    "ma-sanli",
                    "guo-degang",
                    "liu-baorui",
                    "chang-baokun",
                  ]
                    .filter((p) => p !== selected.id)
                    .map((p) => (
                      <option key={p} value={p}>
                        {peopleById[p].name}一脉
                      </option>
                    ))}
                </select>
                <CaretDown size={15} />
              </label>
            </div>
            <AtlasGraph
              active={graph}
              selectedId={selected.id}
              mode={graphMode}
              query={state.query}
              generation={state.generation}
              onSelect={select}
            />
            <div className="generation-bar">
              <span>字辈</span>
              <button
                className={!state.generation ? "active" : ""}
                onClick={() => change({ generation: "" })}
              >
                全部
              </button>
              {GENERATIONS.map((g) => (
                <button
                  key={g}
                  className={state.generation === g ? "active" : ""}
                  aria-pressed={state.generation === g}
                  onClick={() =>
                    change({ generation: state.generation === g ? "" : g })
                  }
                >
                  {g}
                </button>
              ))}
              {(state.query || state.generation) && (
                <button
                  className="clear-filters"
                  onClick={() => change({ generation: "", query: "" })}
                >
                  清除筛选
                </button>
              )}
            </div>
          </section>
          <aside
            className={`person-summary ${drawer ? "is-expanded" : ""}`}
            aria-label="人物摘要"
          >
            <button
              className="mobile-summary-toggle"
              aria-expanded={drawer}
              onClick={() => setDrawer(!drawer)}
            >
              {selected.name} · 人物资料
              <CaretDown size={18} />
            </button>
            <div className="summary-body">
              <span className="generation-seal">
                {selected.generation ?? "谱"}
              </span>
              <h2>{selected.name}</h2>
              <p className="summary-years">{lifespan(selected)}</p>
              <p className="summary-meta">
                {selected.generation
                  ? `${selected.generation}字辈`
                  : "字辈待考"}
                {selected.school && ` · ${selected.school}`}
              </p>
              <section>
                <h3>师承</h3>
                {mentors.length ? (
                  mentors.map((p) => (
                    <button
                      className="mentor-link"
                      key={p.id}
                      onClick={() => select(p.id)}
                    >
                      {p.name}
                    </button>
                  ))
                ) : (
                  <p>资料待考</p>
                )}
              </section>
              <section>
                <h3>代表作品</h3>
                {selected.works.length ? (
                  <ul>
                    {selected.works.slice(0, 3).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <p>作品资料待补</p>
                )}
              </section>
              {personalEvents.length > 0 && (
                <button
                  className="event-count"
                  onClick={() => view("timeline")}
                >
                  {personalEvents.length} 条事件与核验记录
                  <ArrowUpRight size={16} />
                </button>
              )}
              <div className="summary-actions">
                <button className="inline-link" onClick={() => view("book")}>
                  展开人物书笺
                  <ArrowRight size={22} />
                </button>
                <button
                  onClick={() =>
                    view(state.view === "tree" ? "scroll" : "tree")
                  }
                >
                  {state.view === "tree"
                    ? "在山水长卷中浏览"
                    : "在世代谱系中定位"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </aside>
        </div>
        {state.view === "book" && (
          <PersonBook
            key={selected.id}
            person={selected}
            onSelect={select}
            onLocate={() => view("tree")}
          />
        )}
        {state.view === "timeline" && (
          <TimelineView person={selected} onSelect={select} />
        )}
      </div>
      <footer className="site-footer">
        <span>
          {graph
            ? "拖动平移 · 点选人物 · 展开支系"
            : state.view === "book"
              ? "翻页阅读 · 随时返回图谱"
              : "沿年查事 · 循源核实"}
        </span>
        <span>同一人物 · 多种阅法</span>
        <button onClick={() => openPanel("evidence")}>
          查看出处
          <ArrowUpRight size={19} />
        </button>
      </footer>
      {panel && (
        <EvidencePanel type={panel} onClose={closePanel} onSelect={select} />
      )}
    </main>
  );
}
