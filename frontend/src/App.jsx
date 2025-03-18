import React, { useState, useEffect } from "react";
import { ChakraProvider, Box, ColorModeScript } from "@chakra-ui/react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import ArtGallery from "./components/ArtGallery";
import ArtDetailPage from "./components/ArtDetailPage";
import ImageUploadModal from "./components/ImageUploadModal";
import AnalyticsPage from "./components/AnalyticsPage";
import AdminTab from "./components/AdminTab";
import UserProfile from "./components/UserProfile";
import MainGallery from "./components/MainGallery";
import UserProvider from "./contexts/UserContext";
import fetchAPI from "./services/api";
import { GoogleOAuthProvider } from "@react-oauth/google";
import theme from "./theme";
import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes as default stale time
      cacheTime: 10 * 60 * 1000, // 10 minutes as default cache time
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// Create a persisters
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "art-gallery-cache", // unique key for localStorage
  throttleTime: 1000, // don't write to localStorage more than once per second
});

function App() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleUploadClick = () => {
    document.getElementById("file-upload").click();
  };

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
      onSuccess={() => {
        console.log("Cache restored from localStorage");
      }}
    >
      <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}>
        <Router>
          <ChakraProvider theme={theme}>
            <UserProvider>
              <ColorModeScript
                initialColorMode={theme.config.initialColorMode}
              />
              <Header
                onUploadClick={handleUploadClick}
                onSearchChange={(e) => {
                  if (e.key === "Enter") {
                    setSearchQuery(e.target.value);
                  }
                }}
              />
              <ImageUploadModal />

              <Box pt={84}>
                <ScrollToTop />
                <Routes>
                  <Route
                    path="/"
                    element={<MainGallery searchQuery={searchQuery} />}
                  />
                  <Route path="/art/:id" element={<ArtDetailPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/admin" element={<AdminTab />} />
                  <Route path="/profile" element={<UserProfile />} />
                </Routes>
              </Box>
            </UserProvider>
          </ChakraProvider>
        </Router>
      </GoogleOAuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;

/*
import React from "react";
import { ChakraProvider } from "@chakra-ui/react";
import Gallery from "react-photo-gallery";
import "./App.css";

const photos = [
  {
    src: "https://source.unsplash.com/2ShvY8Lf6l0/800x599",
    width: 63,
    height: 32,
    id: "unique-photo-id-1",
  },
  {
    src: "https://source.unsplash.com/Dm-qxdynoEc/800x799",
    width: 1,
    height: 1,
    id: "unique-photo-id-2",
  },
  {
    src: "https://source.unsplash.com/qDkso9nvCg0/600x799",
    width: 3,
    height: 4,
    id: "unique-photo-id-3",
  },
];

const handleImageClick = (event, { photo, index }) => {
  console.log("Clicked on photo ID:", photo.id);
};

const App = () => (
  <ChakraProvider theme={theme}>
    <Gallery photos={photos} direction={"column"} onClick={handleImageClick} />
  </ChakraProvider>
);

export default App;
*/
