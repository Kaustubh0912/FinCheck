import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { applyTheme, getInitialTheme } from "./lib/theme";
import App from "./App";
import "./styles/global.css";

import { configureBoneyard } from 'boneyard-js/react';
import './bones/registry';

configureBoneyard({
  animate: 'shimmer',
  color: 'var(--shade-2)',
  darkColor: 'var(--shade-2)'
});

applyTheme(getInitialTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
