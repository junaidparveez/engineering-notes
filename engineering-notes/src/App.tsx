import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './components/dashboard/DashboardPage';
import InterviewPage from './components/interview/InterviewPage';
import NotesPage from './components/notes/NotesPage';
import ProjectsPage from './components/projects/ProjectsPage';
import ResourcesPage from './components/resources/ResourcesPage';
import RoadmapPage from './components/roadmap/RoadmapPage';
import SettingsPage from './components/settings/SettingsPage';
import SkillsPage from './components/skills/SkillsPage';

/**
 * One route per view. The old app hid and showed <section> elements with a
 * class; now each view has a URL, so /roadmap is linkable and the browser back
 * button does what it should.
 *
 * The nested routes render inside AppLayout's <Outlet />.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Anything unrecognised goes home rather than showing a blank frame. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
