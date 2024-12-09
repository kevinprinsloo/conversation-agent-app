import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import CallAnalytics from "./pages/CallAnalytics";

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/callAnalytics" element={<CallAnalytics />} />
      </Routes>
    </Router>
  );
}

export default AppRouter;
