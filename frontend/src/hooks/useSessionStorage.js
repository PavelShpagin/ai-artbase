import { useState, useEffect } from "react";

/**
 * Custom hook for managing state that persists in sessionStorage
 *
 * @param {string} key - The key to use in sessionStorage
 * @param {any} initialValue - The initial value if nothing exists in storage
 * @returns {[any, Function]} - State value and setter function
 */
const useSessionStorage = (key, initialValue) => {
  // Initialize state with value from sessionStorage or fallback to initialValue
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Get stored value from sessionStorage
      const item = window.sessionStorage.getItem(key);

      // Parse stored JSON or return initialValue if storage is empty
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update sessionStorage when state changes
  useEffect(() => {
    try {
      // Save state to sessionStorage
      window.sessionStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error writing to sessionStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Return state and setter function
  return [storedValue, setStoredValue];
};

export default useSessionStorage;
