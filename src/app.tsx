import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import EditorPage from '@/pages/EditorPage/EditorPage';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<EditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
