import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CaretDown,
  ArrowsOut,
  ArrowsIn,
} from "@phosphor-icons/react";
import { peopleById, mentorsOf, searchPeople } from "../lib/catalog";
import { eventsForPerson } from "../lib/events";
import { readBrowseState, updateBrowseSearch, VIEWS } from "../lib/browsing";
import type { BrowseState, BrowseView } from "../lib/browsing";
import { GENERATIONS } from "../types";
import { AtlasGraph } from "./AtlasGraph";
import { PersonBook, lifespan } from "./PersonBook";
import { TimelineView } from "./TimelineView";
import { PersonSearch } from "./PersonSearch";
import { EvidencePanel } from "./EvidencePanel";
import { useStudioMotion } from "../lib/useStudioMotion";

export function Studio() {
  const { id } = useParams(),
    location = useLocation(),
    navigate = useNavigate();
  const state = readBrowseState(location.search);
  const knownPerson = id !== undefined && Object.hasOwn(peopleById, id);
  const selected = knownPerson ? peopleById[id] : peopleById["hou-baolin"];
  const motionRoot = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (summaryRef.current) summaryRef.current.scrollTop = 0;
  }, [selected.id]);
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const sync = () =>
      setImmersive(document.fullscreenElement === motionRoot.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImmersive(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const toggleFullscreen = async () => {
    if (immersive) {
      setImmersive(false);
      if (document.fullscreenElement) await document.exitFullscreen();
    } else {
      setImmersive(true);
      try {
        await motionRoot.current?.requestFullscreen?.();
      } catch {
        /* In-page immersive layout remains available. */
      }
    }
  };
  const transitioning = useStudioMotion(motionRoot, state.view, selected.id);
  const [graphMode, setGraphMode] = useState<"scroll" | "tree">(
    state.view === "tree" ? "tree" : "scroll",
  );
  useEffect(() => {
    if (state.view === "scroll" || state.view === "tree")
      setGraphMode(state.view);
  }, [state.view]);
  const [drawer, setDrawer] = useState(false);
  type Stop = { url: string; name: string };
  const trail: Stop[] = location.state?.personTrail ?? [];
  const previousPerson = trail.at(-1);
  const [panel, setPanel] = useState<"people" | "evidence" | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openPanel = (type: "people" | "evidence", opener?: HTMLElement) => {
    openerRef.current = opener ?? document.activeElement as HTMLElement;
    setPanel(type);
  };
  const closePanel = () => {
    setPanel(null);
  };
  useEffect(() => {
    if (!panel && openerRef.current) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [panel]);
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
      { replace: patch.query !== undefined, state: location.state },
    );
  const select = (next: string) => {
    const search = updateBrowseSearch(location.search, { query: "" });
    const target = `/p/${next}${search ? `?${search}` : ""}`;
    if (next !== selected.id) {
      navigate(target, { state: { personTrail: [...trail, { url: location.pathname + location.search, name: selected.name }].slice(-12) } });
    } else if (target !== location.pathname + location.search) {
      navigate(target, { replace: true, state: location.state });
    }
    setDrawer(false);
  };
  const view = (next: BrowseView) => {
    if (next === state.view) return;
    change({ view: next });
    setDrawer(false);
  };
  const matchingPeople = searchPeople(state.query).filter(person => !state.generation || person.generation === state.generation);
  const selectedMatches = matchingPeople.some(person => person.id === selected.id);
  const graph = state.view === "scroll" || state.view === "tree";
  const mentors = mentorsOf(selected.id),
    personalEvents = eventsForPerson(selected.id);
  return (
    <main
      ref={motionRoot}
      className={`ink-app view-${state.view}${immersive ? " is-immersive" : ""}`}
      data-transition={transitioning ? "moving" : "settled"}
    >
      <div className="studio-content" inert={!!panel}>
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
          <button onClick={event => openPanel("people", event.currentTarget)}>寻人</button>
          <button onClick={event => openPanel("evidence", event.currentTarget)}>考据</button>
        </nav>
        <PersonSearch query={state.query} onQuery={query => change({ query })}
          onSelect={select} onDirectory={() => openPanel("people")} />
      </header>
      <section className="view-bar">
        {previousPerson && <button className="person-back" onClick={() => {
          navigate(previousPerson.url, { state: { personTrail: trail.slice(0, -1) } });
          setDrawer(false);
        }}>← 返回{previousPerson.name}</button>}
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
        <p className="current-person" role="status" aria-live="polite">
          {transitioning &&
            `正在切换至${VIEWS.find((v) => v.id === state.view)?.label} · `}
          当前人物：{selected.name} ·{" "}
          {selected.generation ? `${selected.generation}字辈` : "字辈待考"}
          {selected.originalGeneration ? `（原始${selected.originalGeneration}字辈）` : ""}
        </p>
      </section>
      {id && !knownPerson && (
        <div className="notice">
          没有找到该人物，已为你打开侯宝林。
          <button onClick={event => openPanel("people", event.currentTarget)}>查看人物索引</button>
        </div>
      )}
      {graph && (state.query || state.generation) && <div className="filter-feedback">
        <p role="status">{state.query && `检索“${state.query}” · `}{state.generation && `${state.generation}字辈 · `}
          {matchingPeople.length ? `${matchingPeople.length} 位匹配` : "没有匹配人物"}
          {!selectedMatches && ` · ${selected.name}作为当前人物保留`}
        </p>
        <button onClick={() => change({ generation: "", query: "" })}>重置筛选</button>
      </div>}
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
                    "ma-delu",
                    "guo-degang",
                    "liu-baorui",
                    "chang-baokun",
                    "gao-fengshan",
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
                aria-pressed={!state.generation}
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
            ref={summaryRef}
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
                {selected.originalGeneration && ` · 原始${selected.originalGeneration}字辈`}
                {selected.school && ` · ${selected.school}`}
              </p>
              <section className="summary-story">
                <h3>人物小传</h3>
                <p>{selected.bio}</p>
                {selected.generationNote && <div className="summary-generation-note">
                  <strong>字辈调整{selected.originalGeneration && ` · 原${selected.originalGeneration} → ${selected.generation ?? '待考'}`}</strong>
                  <p>{selected.generationNote}</p>
                </div>}
                {!!selected.notes?.length && <details key={selected.id}>
                  <summary>师承补记 · {selected.notes.length} 条</summary>
                  {selected.notes.map((note, index) => <p key={index}>{note}</p>)}
                </details>}
              </section>
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
        {immersive && graph && (
          <button aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
            {drawer ? "收起资料" : "人物资料"}
          </button>
        )}
        <button
          className="fullscreen-toggle"
          aria-pressed={immersive}
          onClick={toggleFullscreen}
        >
          {immersive ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
          {immersive ? "退出全屏" : "全屏阅读"}
        </button>
        <button onClick={event => openPanel("evidence", event.currentTarget)}>
          查看出处
          <ArrowUpRight size={19} />
        </button>
      </footer>
      </div>
      {panel && (
        <EvidencePanel initialQuery={state.query} type={panel} onClose={closePanel} onSelect={select} />
      )}
    </main>
  );
}
