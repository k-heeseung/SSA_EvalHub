import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import EvaluatorLayout from './layouts/EvaluatorLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProgramsPage from './pages/ProgramsPage';
import EvaluatorsPage from './pages/EvaluatorsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import EvaluatorDashboardPage from './pages/EvaluatorDashboardPage';
import EvaluationPage from './pages/EvaluationPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 관리자 화면 */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="evaluators" element={<EvaluatorsPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* 심사위원 화면 */}
        <Route path="/evaluator" element={<EvaluatorLayout />}>
          <Route index element={<EvaluatorDashboardPage />} />
          <Route path="evaluate/:assignmentId" element={<EvaluationPage />} />
        </Route>

        {/* 기본: 로그인으로 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
