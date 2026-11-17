import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import EvaluatorLayout from './layouts/EvaluatorLayout';
import ApplicantLayout from './layouts/ApplicantLayout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import EvaluatorsPage from './pages/EvaluatorsPage';
import ManagersPage from './pages/ManagersPage';
import AssignmentsPage from './pages/AssignmentsPage';
import EvaluatorDashboardPage from './pages/EvaluatorDashboardPage';
import EvaluationTeamsPage from './pages/EvaluationTeamsPage';
import EvaluationPage from './pages/EvaluationPage';
import CreateProgramPage from './pages/CreateProgramPage';
import TeamDetailPage from './pages/TeamDetailPage';
import TeamBonusPage from './pages/TeamBonusPage';
import TeamsPage from './pages/TeamsPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import ApplicantHomePage from './pages/ApplicantHomePage';
import ApplicantProgramPage from './pages/ApplicantProgramPage';
import ApplicantSubmissionsPage from './pages/ApplicantSubmissionsPage';
import ApplicantFormPage from './pages/ApplicantFormPage';
import ApplicantSubmittedPage from './pages/ApplicantSubmittedPage';
import ApplicantTeamPage from './pages/ApplicantTeamPage';
import RequireAuth from './components/RequireAuth';

const router = createBrowserRouter(createRoutesFromElements(
      <>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 운영 */}
        <Route path="/operations" element={(
          <RequireAuth roles={['SUPER_ADMIN', 'MANAGER']}>
            <AdminLayout />
          </RequireAuth>
        )}>
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/new" element={<CreateProgramPage />} />
          <Route path="programs/:programId" element={<ProgramDetailPage />} />
          <Route path="programs/:programId/edit" element={<CreateProgramPage />} />
          <Route path="programs/:programId/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="programs/:programId/bonus/:teamId" element={<TeamBonusPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="coordinators" element={<ManagersPage />} />
          <Route path="evaluators" element={<EvaluatorsPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route index element={<Navigate to="programs" replace />} />
        </Route>

        {/* 심사위원 */}
        <Route path="/evaluator" element={(
          <RequireAuth roles={['EVALUATOR']}>
            <EvaluatorLayout />
          </RequireAuth>
        )}>
          <Route index element={<EvaluatorDashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="evaluate/:assignmentId/teams" element={<EvaluationTeamsPage />} />
          <Route path="evaluate/:assignmentId/teams/:teamId" element={<EvaluationPage />} />
        </Route>

        {/* 지원자 */}
        <Route path="/applicant" element={(
          <RequireAuth roles={['MEMBER']}>
            <ApplicantLayout />
          </RequireAuth>
        )}>
          <Route index element={<ApplicantHomePage />} />
          <Route path="programs/:programId" element={<ApplicantProgramPage />} />
          {/* 구 '지원하기' 경로는 통합된 인덱스로 리다이렉트 */}
          <Route path="apply" element={<Navigate to="/applicant" replace />} />
          <Route path="apply/:applicationId" element={<ApplicantFormPage />} />
          <Route path="submissions" element={<ApplicantSubmissionsPage />} />
          <Route path="submissions/:applicationId" element={<ApplicantSubmittedPage />} />
          <Route path="team" element={<ApplicantTeamPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </>
));

export default function App() {
  return <RouterProvider router={router} />;
}
