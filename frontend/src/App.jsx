import React, { createContext, useState, useContext, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ChakraProvider, Box, ColorModeScript } from "@chakra-ui/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import UserProvider from "./contexts/UserContext";
import Header from "./components/Header";
import ImageUploadModal from "./components/ImageUploadModal";
import AnalyticsPage from "./components/AnalyticsPage";
import AdminTab from "./components/AdminTab";
import UserProfile from "./components/UserProfile";
import theme from "./theme";
import "./App.css";
import ArtDetailPage from "./components/ArtDetailPage";
import MainGallery from "./components/MainGallery";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LikedPage from "./components/LikedPage";
import GeneratePage from "./components/GeneratePage";
// Create a context to share the search query across routes
const SearchQueryContext = createContext();

export const SearchQueryProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [uiSearchQuery, setUiSearchQuery] = useState("");
  return (
    <SearchQueryContext.Provider
      value={{ searchQuery, setSearchQuery, uiSearchQuery, setUiSearchQuery }}
    >
      {children}
    </SearchQueryContext.Provider>
  );
};

export const useSearchQuery = () => useContext(SearchQueryContext);

// Create QueryClient outside component to avoid recreating on each render
const queryClient = new QueryClient();

function clearArtLocalStorage() {
  // Remove all keys starting with "arts-" or "art-"
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("arts-") || key.startsWith("art-")) {
      localStorage.removeItem(key);
    }
  });
}

function useTabCounter() {
  useEffect(() => {
    // Increment on open
    const tabKey = "openTabCount";
    let count = parseInt(localStorage.getItem(tabKey) || "0", 10);
    localStorage.setItem(tabKey, String(count + 1));

    // Listen for storage changes from other tabs
    const handleStorage = (e) => {
      if (e.key === tabKey && parseInt(e.newValue, 10) === 0) {
        clearArtLocalStorage();
      }
    };
    window.addEventListener("storage", handleStorage);

    // On close, decrement
    const handleUnload = () => {
      let count = parseInt(localStorage.getItem(tabKey) || "1", 10);
      count = Math.max(0, count - 1);
      localStorage.setItem(tabKey, String(count));
      if (count === 0) {
        clearArtLocalStorage();
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    // Cleanup
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("beforeunload", handleUnload);
      // Also decrement if React unmounts (shouldn't happen, but for safety)
      let count = parseInt(localStorage.getItem(tabKey) || "1", 10);
      count = Math.max(0, count - 1);
      localStorage.setItem(tabKey, String(count));
      if (count === 0) {
        clearArtLocalStorage();
      }
    };
  }, []);
}

function App() {
  useTabCounter();

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}>
        <ChakraProvider theme={theme}>
          <UserProvider>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <SearchQueryProvider>
              <Router>
                <Header />
                <ImageUploadModal />
                <Box pt={84}>
                  <Routes>
                    <Route path="/" element={<MainGallery />} />
                    <Route path="/:id" element={<ArtDetailPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/admin" element={<AdminTab />} />
                    <Route path="/profile/:id" element={<UserProfile />} />
                    <Route path="/liked" element={<LikedPage />} />
                    <Route path="/generate" element={<GeneratePage />} />
                  </Routes>
                </Box>
              </Router>
            </SearchQueryProvider>
          </UserProvider>
        </ChakraProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
