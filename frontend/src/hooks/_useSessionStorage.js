// import { useState, useEffect } from "react";

// /**
//  * Custom hook for managing state that persists in localStorage
//  *
//  * @param {string} key - The key to use in localStorage
//  * @param {any} initialValue - The initial value if nothing exists in storage
//  * @returns {[any, Function]} - State value and setter function
//  */
// const useSessionStorage = (key, initialValue) => {
//   // Initialize state with value from localStorage or fallback to initialValue
//   const [storedValue, setStoredValue] = useState(() => {
//     try {
//       // Get stored value from localStorage
//       const item = window.localStorage.getItem(key);

//       // Parse stored JSON or return initialValue if storage is empty
//       return item ? JSON.parse(item) : initialValue;
//     } catch (error) {
//       console.error(`Error reading localStorage key "${key}":`, error);
//       return initialValue;
//     }
//   });

//   // Update localStorage when state changes
//   useEffect(() => {
//     try {
//       // Save state to localStorage
//       window.localStorage.setItem(key, JSON.stringify(storedValue));
//     } catch (error) {
//       console.error(`Error writing to localStorage key "${key}":`, error);
//     }
//   }, [key, storedValue]);

//   // Return state and setter function
//   return [storedValue, setStoredValue];
// };

// export default useSessionStorage;
