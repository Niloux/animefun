import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import HomePage from "./pages/Home";
import SearchPage from "./pages/Search";
import SubscribePage from "./pages/Subscribe";
import ResourcesAllPage from "./pages/Resources/All";
import ResourcesDownloadingPage from "./pages/Resources/Downloading";
import ResourcesDownloadedPage from "./pages/Resources/Downloaded";
import SettingsPage from "./pages/Settings";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Default redirect to home */}
          <Route index element={<Navigate to="/home" replace />} />

          {/* Home */}
          <Route path="/home" element={<HomePage />} />

          {/* Search */}
          <Route path="/search" element={<SearchPage />} />

          {/* Subscribe */}
          <Route path="/subscribe" element={<SubscribePage />} />

          {/* Resources */}
          <Route path="/resources/all" element={<ResourcesAllPage />} />
          <Route path="/resources/downloading" element={<ResourcesDownloadingPage />} />
          <Route path="/resources/downloaded" element={<ResourcesDownloadedPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;