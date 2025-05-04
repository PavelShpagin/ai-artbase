import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export function useAuthRedirect() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem("scrollPosition-main-", "0");
      navigate("/");
    }
  }, [user, navigate]);
}
