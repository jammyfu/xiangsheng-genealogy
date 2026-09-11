import { useState } from "react";
import { X, ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { people, sources, edges, searchPeople } from "../lib/catalog";
import { events } from "../lib/events";
import { SourceLinks } from "./SourceLinks";

export function EvidencePanel({
  type,
  onClose,
  onSelect,
}: {
  type: "people" | "evidence";
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const list = searchPeople(query);
  const verifiedPeople = new Set(
    events.filter((e) => e.status !== "unverified").flatMap((e) => e.people),
  );
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <section
        className="library-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const elements = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button,a,input,select,[tabindex="0"]',
              ),
            ).filter((el) => !el.hasAttribute("disabled"));
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <div>
            <p className="eyebrow">
              相声家谱 · {type === "people" ? "人物索引" : "资料考据"}
            </p>
            <h2 id="library-title">
              {type === "people" ? "寻一位先生" : "事有据，言有源"}
            </h2>
          </div>
          <button
            autoFocus
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={25} />
          </button>
        </header>
        {type === "people" ? (
          <>
            <label className="directory-search">
              <MagnifyingGlass size={22} />
              <input
                placeholder="输入姓名、艺名或拼音标识"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <p className="muted">
              已收录 {people.length} 位 · 当前找到 {list.length} 位
            </p>
            <div className="people-directory">
              {list.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    onClose();
                  }}
                >
                  <span>{p.name}</span>
                  <small>
                    {p.generation ? `${p.generation}字辈` : "字辈待考"}
                  </small>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
            {!list.length && (
              <p className="empty-state">
                没有找到这位先生，试试其他姓名或艺名。
              </p>
            )}
          </>
        ) : (
          <>
            <p className="evidence-intro">
              师承记录历史，事件记录变化。退社、除名与暂停演出分别记载；当事人的说法注明归属，不直接作为定论。
            </p>
            <div className="coverage-stats">
              <div>
                <strong>{people.length}</strong>
                <span>收录人物</span>
              </div>
              <div>
                <strong>{events.length}</strong>
                <span>事件记录</span>
              </div>
              <div>
                <strong>{verifiedPeople.size}</strong>
                <span>人物已有新核验事件</span>
              </div>
            </div>
            <section>
              <h3>如何读这份家谱</h3>
              <dl className="evidence-legend">
                <dt>已有报道</dt>
                <dd>来源支持事件曾发生；不意味着报道中的每句评价都成立。</dd>
                <dt>当事人说法</dt>
                <dd>核验到本人或组织公开发表该说法，具体解释保留归因。</dd>
                <dt>存在分歧</dt>
                <dd>不同来源或当事人说法不一致，逐项列示。</dd>
                <dt>待核实</dt>
                <dd>原有资料、精度不足或尚未重新打开核对的记录。</dd>
              </dl>
            </section>
            <section>
              <h3>覆盖与待补</h3>
              <p>
                已收录 {edges.length} 条历史师承关系、{sources.length}{" "}
                份来源记录。原有人物主要来自种子谱表，尚未全部逐人、逐关系完成独立核验。缺少某条事件不代表该事件没有发生。
              </p>
              <p>
                新增事件以能打开的公开报道为起点；同一声明的多次转载按同一来源链理解，不累加成独立证据。
              </p>
            </section>
            <section>
              <h3>来源目录</h3>
              <SourceLinks ids={sources.map((s) => s.id)} />
            </section>
          </>
        )}
      </section>
    </div>
  );
}
