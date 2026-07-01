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

export default function App() {
  const { user, loading, hydrating } = useAuth();

  if (loading && !user) {
    return <Login hydrating={hydrating} />;
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
