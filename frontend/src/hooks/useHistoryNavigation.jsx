import { useEffect, useState } from "react";
import { useNavigationType } from "react-router-dom";

/**
 * Custom hook to handle browser back/forward navigation
 * @param {Function} onNavigate - Callback function executed when back/forward navigation happens
 * @returns {Object} Navigation state information
 */
const useHistoryNavigation = (onNavigate) => {
  const navType = useNavigationType();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Only run when navigation type is POP (back/forward buttons)
    if (navType === "POP") {
      setIsNavigating(true);

      // Execute the callback with the state from history
      if (typeof onNavigate === "function") {
        const state = window.history.state;
        onNavigate(state);
      }

      // Reset the flag after a short delay
      setTimeout(() => {
        setIsNavigating(false);
      }, 100);
    }
  }, [navType, onNavigate]);

  useEffect(() => {
    // Create a listener for browser popstate event
    // This provides a more direct way to detect back/forward navigation
    const handlePopState = (event) => {
      setIsNavigating(true);

      if (typeof onNavigate === "function") {
        onNavigate(event.state);
      }

      setTimeout(() => {
        setIsNavigating(false);
      }, 100);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [onNavigate]);

  return {
    isNavigating,
    isBackForwardNavigation: navType === "POP",
  };
};

export default useHistoryNavigation;
