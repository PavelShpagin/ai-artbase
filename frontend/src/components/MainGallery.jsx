import React, { useEffect, useState } from "react";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api";

const MainGallery = ({ searchQuery }) => {
  const [arts, setArts] = useState([]);

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

  return <ArtGallery arts={arts} />;
};

export default MainGallery;
