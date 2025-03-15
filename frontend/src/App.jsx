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
//import Gallery from "react-photo-gallery";

<<<<<<< HEAD
function App() {
  const [arts, setArts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
=======
const ScrollToTop = () => {
  const { pathname } = useLocation();
>>>>>>> d8c9af58edabbb75d331a1f228de1d5d4069d5b3

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

function App() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleUploadClick = () => {
    document.getElementById("file-upload").click();
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}>
      <Router>
        <ChakraProvider theme={theme}>
          <UserProvider>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
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
