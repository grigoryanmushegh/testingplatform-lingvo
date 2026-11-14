import { useNavigate } from "react-router-dom";
import { SignUpForm } from "../../components/StudentPortal.jsx";

export default function SignUpPage() {
  const navigate = useNavigate();
  return <SignUpForm onBack={() => navigate("/")} />;
}
