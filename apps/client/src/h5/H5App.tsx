import { Route, Routes } from 'react-router-dom';
import CourierPage from './pages/CourierPage';
import FamilyPage from './pages/FamilyPage';
import RolePage from './pages/RolePage';
import SignPage from './pages/SignPage';

export default function H5App() {
  return (
    <Routes>
      <Route path="/" element={<RolePage />} />
      <Route path="/family" element={<FamilyPage />} />
      <Route path="/courier" element={<CourierPage />} />
      <Route path="/sign/:token" element={<SignPage />} />
    </Routes>
  );
}
