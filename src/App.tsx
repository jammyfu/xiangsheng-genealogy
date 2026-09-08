import { Navigate, Route, Routes } from 'react-router-dom';
import { Studio } from './components/Studio';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Studio />} />
      <Route path="/p/:id" element={<Studio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
