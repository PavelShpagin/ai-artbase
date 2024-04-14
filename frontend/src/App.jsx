import React, { useState, useEffect } from "react";
import { ChakraProvider, Box, ColorModeScript } from "@chakra-ui/react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import Header from "./components/Header";
import ArtGallery from "./components/ArtGallery";
import ArtDetailPage from "./components/ArtDetailPage";
import ImageUploadModal from "./components/ImageUploadModal";
import AnalyticsPage from "./components/AnalyticsPage";
import fetchAPI from "./services/api";
import { GoogleOAuthProvider } from "@react-oauth/google";
import theme from "./theme";
import "./App.css";
//import Gallery from "react-photo-gallery";

const clientId =
  "773557299658-hhspu7b958jg9iad4onunnr1onojuomq.apps.googleusercontent.com";

//const storedToken = localStorage.getItem("token");
//const initialUser = storedUser ? JSON.parse(storedUser) : null;

function App() {
  const [arts, setArts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log(token);
    const fetchUser = async () => {
      if (token) {
        try {
          // Assuming '/users/me' is the FastAPI endpoint to get user details
          //const userData = await fetchAPI("/users/me", "GET", null, {
          //  Authorization: `Bearer ${token}`,
          //});
          //console.log(userData);
          //setUser(userData);
        } catch (error) {
          console.error("Failed to fetch user:", error);
        }
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const fetchArts = async () => {
      const endpoint = searchQuery
        ? `/search/?query=${encodeURIComponent(searchQuery)}`
        : "/arts/";
      try {
        const response = await fetchAPI(endpoint);
        console.log(response);
        setArts(response);
      } catch (error) {
        console.error("Failed to fetch arts:", error);
      }
    };
    fetchArts();
  }, [searchQuery]);

  const handleUploadClick = () => {
    document.getElementById("file-upload").click();
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Router>
        <ChakraProvider theme={theme}>
          <ColorModeScript initialColorMode={theme.config.initialColorMode} />
          <Header
            user={user}
            setUser={setUser}
            onUploadClick={handleUploadClick}
            onSearchChange={(e) => {
              if (e.key === "Enter") {
                setSearchQuery(e.target.value);
              }
            }}
          />
          <ImageUploadModal user={user} />
          <Box pt={84}>
            <Routes>
              <Route path="/" element={<ArtGallery arts={arts} />} />
              <Route path="/art/:id" element={<ArtDetailPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Routes>
          </Box>
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
