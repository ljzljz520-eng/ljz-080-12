import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import AdminLayout from './pages/admin/AdminLayout';
import MealBoardPage from './pages/admin/MealBoardPage';
import ExceptionsPage from './pages/admin/ExceptionsPage';
import StatsPage from './pages/admin/StatsPage';
import H5Home from './pages/h5/H5Home';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<MealBoardPage />} />
        <Route path="board" element={<MealBoardPage />} />
        <Route path="exceptions" element={<ExceptionsPage />} />
        <Route path="stats" element={<StatsPage />} />
      </Route>
      <Route path="/h5" element={<H5Home />} />
    </Routes>
  );
}
