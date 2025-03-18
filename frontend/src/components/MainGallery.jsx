import React from "react";
import { useQuery } from "@tanstack/react-query";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api";

const MainGallery = ({ searchQuery }) => {
  const {
    data: arts = [],
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["arts", searchQuery],
    queryFn: async () => {
      const endpoint = searchQuery
        ? `/search/?query=${encodeURIComponent(searchQuery)}`
        : "/arts/";

      console.log("Fetching fresh art data"); // Debug logging to confirm when data is actually fetched

      const response = await fetchAPI(endpoint, "GET", null);
      return response;
    },
    staleTime: 5 * 60 * 1000, // This is already set to 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes even after becoming stale
    refetchOnMount: false, // Don't refetch when component mounts if data isn't stale
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // You can add a debug message to show when cached data is used
  React.useEffect(() => {
    if (!isLoading && !isRefetching) {
      console.log("Using cached art data");
    }
  }, [isLoading, isRefetching]);

  return (
    <>
      {isLoading ? (
        <div className="flex justify-center py-4 w-full">
          <div className="animate-pulse">Loading gallery...</div>
        </div>
      ) : (
        <>
          <ArtGallery arts={arts} />
        </>
      )}
    </>
  );
};

export default MainGallery;
