import { useNavigate } from "react-router-dom";
import { C } from "../../lib/constants.js";
import TopBar from "../../components/TopBar.jsx";
import HomePage from "../../components/HomePage.jsx";

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header>
        <TopBar
          onAdmin={() => navigate("/admin")}
          onLogin={() => navigate("/login")}
          onSignUp={() => navigate("/signup")}
        />
      </header>
      <main id="main-content">
        <HomePage
          onStart={() => navigate("/test")}
          onAdmin={() => navigate("/admin")}
          onStudentLogin={() => navigate("/login")}
        />
      </main>
    </div>
  );
}
