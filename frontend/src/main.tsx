import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import PageErrorBoundary from "./components/PageErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PageErrorBoundary standalone>
      <App />
    </PageErrorBoundary>
  </StrictMode>,
);
