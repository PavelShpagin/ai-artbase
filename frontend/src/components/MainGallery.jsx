import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";

const MainGallery = () => {
  const { searchQuery } = useSearchQuery();
  const [isSearching, setIsSearching] = useState(false);

  const { data: arts, isLoading } = useQuery({
    queryKey: ["arts", searchQuery],
    queryFn: async () => {
      try {
        setIsSearching(true);

        const endpoint = searchQuery
          ? `/search/?query=${encodeURIComponent(searchQuery)}`
          : "/arts/";

        const response = await fetchAPI(endpoint);
        return response;
      } catch (error) {
        throw new Error("Failed to fetch arts: " + error.message);
      } finally {
        setIsSearching(false);
      }
    },
    staleTime: Infinity, // 5 minutes
    cacheTime: Infinity, // 10 minutes
  });

  return (
    <>
      {isLoading || isSearching ? (
        <ArtGallery arts={[]} />
      ) : (
        <ArtGallery arts={arts} />
      )}
    </>
  );
};

export default MainGallery;
