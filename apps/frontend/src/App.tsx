import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HubLayout } from "@/components/layout/HubLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoginPage } from "@/pages/LoginPage";
import { StudioPage } from "@/pages/StudioPage";
import { OrganizationPage } from "@/pages/OrganizationPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WikiPage } from "@/pages/WikiPage";
import { UsersPage } from "@/pages/UsersPage";

export function App() {
  return (
    <Routes>
      <Route element={<HubLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tutoriais" element={<StudioPage />} />
          <Route path="criar" element={<StudioPage modo="criar" />} />
          <Route path="organizacao" element={<OrganizationPage />} />
          <Route path="wiki" element={<WikiPage />} />
          <Route path="usuarios" element={<UsersPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="entrar" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

