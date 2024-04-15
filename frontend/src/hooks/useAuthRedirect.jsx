import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export function useAuthRedirect() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    }
  }, [localStorage.getItem("token")]);
}
