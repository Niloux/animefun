import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import HomePage from "./pages/Home";
import SearchPage from "./pages/Search";
import SubscribePage from "./pages/Subscribe";
import ResourcesAllPage from "./pages/Resources/All";
import ResourcesDownloadingPage from "./pages/Resources/Downloading";
import ResourcesDownloadedPage from "./pages/Resources/Downloaded";
import SettingsPage from "./pages/Settings";
import { ROUTES } from "./constants/routes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Default redirect to home */}
            <Route index element={<Navigate to={ROUTES.HOME} replace />} />

            {/* Home */}
            <Route path={ROUTES.HOME} element={<HomePage />} />

            {/* Search */}
            <Route path={ROUTES.SEARCH} element={<SearchPage />} />

            {/* Subscribe */}
            <Route path={ROUTES.SUBSCRIBE} element={<SubscribePage />} />

            {/* Resources */}
            <Route path={ROUTES.RESOURCES.ALL} element={<ResourcesAllPage />} />
            <Route
              path={ROUTES.RESOURCES.DOWNLOADING}
              element={<ResourcesDownloadingPage />}
            />
            <Route
              path={ROUTES.RESOURCES.DOWNLOADED}
              element={<ResourcesDownloadedPage />}
            />

            {/* Settings */}
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}

export default App;
