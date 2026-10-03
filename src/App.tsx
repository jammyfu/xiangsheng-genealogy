import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Studio } from './components/Studio';

function MergedPersonRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/p/shao-bing${search}${hash}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Studio />} />
      <Route path="/p/zhu-yunfeng" element={<MergedPersonRedirect />} />
      <Route path="/p/:id" element={<Studio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
