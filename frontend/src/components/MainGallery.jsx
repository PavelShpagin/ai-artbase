import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api";
import { useLocation } from "react-router-dom";

const MainGallery = ({ searchQuery }) => {
  const [isSearching, setIsSearching] = useState(false);
  const location = useLocation();

  // Restore scroll position when navigating back
  useEffect(() => {
    if (location.state?.scrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, location.state.scrollPosition);
      }, 0);
    }
  }, [location]);

  const {
    data: arts = [],
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["arts", searchQuery],
    queryFn: async () => {
      setIsSearching(true);
      const endpoint = searchQuery
        ? `/search/?query=${encodeURIComponent(searchQuery)}`
        : "/arts/";

      console.log(`Fetching art data for: ${searchQuery || "all"}`);

      const response = await fetchAPI(endpoint, "GET", null);
      console.log("response", response);
      setIsSearching(false);
      return response;
    },
  });

  // Debug message to show when cached data is used
  useEffect(() => {
    if (!isLoading && !isRefetching) {
      console.log(`Using cached art data for: ${searchQuery || "all"}`);
    }
  }, [isLoading, isRefetching, searchQuery]);

  return (
    <>
      {isLoading || isRefetching || isSearching ? (
        <ArtGallery arts={[]} />
      ) : (
        <ArtGallery arts={arts} />
      )}
    </>
  );
};

export default MainGallery;
