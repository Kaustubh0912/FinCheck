import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { Accounts } from "./pages/Accounts";
import { Settings } from "./pages/Settings";
import { Splits } from "./pages/Splits";
import { Budget } from "./pages/Budget";
import { Icon } from "./lib/icons";

export default function App() {
  const { user, loading, hydrating } = useAuth();

  // Still verifying a stored token — show clean branded splash screen
  if (hydrating) {
    return (
      <div className="auth-splash">
        <div className="auth-hydrating-bar" />
        <div className="auth-brand">
          <div className="splash-logo"><Icon name="rupee" /></div>
          <h1>FinCheck</h1>
        </div>
      </div>
    );
  }

  if (loading && !user) {
    return <Login />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/splits" element={<Splits />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}
