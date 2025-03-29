import React, { createContext, useState, useContext } from "react";
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

// Create a context to share the search query across routes
const SearchQueryContext = createContext();

export const SearchQueryProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <SearchQueryContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchQueryContext.Provider>
  );
};

export const useSearchQuery = () => useContext(SearchQueryContext);

// Create QueryClient outside component to avoid recreating on each render
const queryClient = new QueryClient();

function App() {
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
