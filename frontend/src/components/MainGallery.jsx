import React, { useState, useEffect, useRef } from "react";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";

const MainGallery = () => {
  const { searchQuery } = useSearchQuery();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
  }, [searchQuery]);

  useEffect(() => {
    const fetchArts = async () => {
      if (isReady) return;
      try {
        if (sessionStorage.getItem(`arts-main-${searchQuery}`)) {
          setIsReady(true);
          return;
        }

        const endpoint = searchQuery
          ? `/search/?query=${encodeURIComponent(searchQuery)}`
          : "/arts/";

        const response = await fetchAPI(endpoint);
        sessionStorage.setItem(
          `arts-main-${searchQuery}`,
          JSON.stringify(response)
        );
        setIsReady(true);
      } catch (error) {
        console.error("Failed to fetch arts: " + error.message);
      }
    };

    fetchArts();
  }, [isReady]);

  return <ArtGallery isReady={isReady} />;
};

export default MainGallery;
