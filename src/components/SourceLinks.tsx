import { ArrowUpRight } from "@phosphor-icons/react";
import { sourcesById } from "../lib/catalog";

export function SourceLinks({ ids }: { ids: string[] }) {
  return (
    <ul className="source-links">
      {[...new Set(ids)].map((id) => {
        const source = sourcesById[id];
        return (
          <li key={id}>
            {source ? (
              <>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                  <ArrowUpRight size={15} />
                </a>
                <small>
                  {source.publisher} · 收录核对 {source.accessed}
                </small>
                {source.note && <p>{source.note}</p>}
              </>
            ) : (
              <span>来源记录待补：{id}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
