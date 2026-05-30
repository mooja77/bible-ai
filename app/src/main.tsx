import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalErrorNotice } from "./components/GlobalErrorNotice";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary
      title="The app hit an unexpected error"
      resetLabel="Reload app"
      onReset={() => window.location.reload()}
    >
      <App />
    </ErrorBoundary>
    <GlobalErrorNotice />
  </React.StrictMode>,
);
