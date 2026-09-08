import { Link } from 'react-router-dom';

export function Studio() {
  return (
    <main className="studio-shell">
      <header className="studio-masthead">
        <p className="eyebrow">Xiangsheng Genealogy</p>
        <h1>相声家谱</h1>
        <p className="lede">
          水墨交互图谱：师承、字辈、作品与出处。脚手架已就位，数据与三维谱系随后写入。
        </p>
        <Link to="/">回卷首</Link>
      </header>
    </main>
  );
}
