import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";
import { useLocation } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { fetchBatchArtData, extractStoredArtIds } from "../services/artService";

const MainGallery = () => {
  const { searchQuery, setSearchQuery } = useSearchQuery();
  const { user } = useUser();
  const prevSearchQueryRef = useRef(searchQuery);
  const location = useLocation();
  const prevUserRef = useRef(user);

  useLayoutEffect(() => {
    const handlePopState = (e) => {
      const query = e?.state?.state || "";
      setSearchQuery(query);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const cachedFetchArts = useCallback(async () => {
    try {
      if (prevSearchQueryRef.current.length === 0 && searchQuery.length === 1) {
        window.history.pushState({ state: searchQuery }, "", "/");
      } else if (
        prevSearchQueryRef.current.length === 1 &&
        searchQuery.length === 0
      ) {
        window.history.popState();
      } else {
        window.history.replaceState({ state: searchQuery }, "", "/");
      }

      prevSearchQueryRef.current = searchQuery;

      const storageKey = `arts-main-${searchQuery}`;

      // Check if we need to update likes information due to user change
      if (
        user?.id !== prevUserRef.current?.id &&
        sessionStorage.getItem(storageKey)
      ) {
        // Extract art IDs from stored data
        const artIds = extractStoredArtIds(storageKey);

        if (artIds.length > 0) {
          // Fetch updated art data with correct liked_by_user information
          const updatedArts = await fetchBatchArtData(
            artIds,
            user,
            `main-${searchQuery}`
          );

          if (updatedArts) {
            // Update session storage with new data
            sessionStorage.setItem(storageKey, JSON.stringify(updatedArts));
            console.log("updatedArts", updatedArts);

            // Update visibleArts in sessionStorage with first batch of updatedArts
            const visibleArtsKey = `visibleArts-main-${searchQuery}`;
            const visibleArtsCount = sessionStorage.getItem(visibleArtsKey)
              ? JSON.parse(sessionStorage.getItem(visibleArtsKey)).length
              : 0;
            sessionStorage.setItem(
              visibleArtsKey,
              JSON.stringify(updatedArts.slice(0, visibleArtsCount))
            );

            // // Update individual art like statuses
            // updatedArts.forEach((art) => {
            //   const likeKey = `art-like-${art.id}-${user?.id || "guest"}`;
            //   sessionStorage.setItem(
            //     likeKey,
            //     JSON.stringify(art.liked_by_user)
            //   );
            // });
          }
        }
      }

      // Update previous user reference
      prevUserRef.current = user;

      // If we already have the data in session storage, return
      if (sessionStorage.getItem(storageKey)) {
        return;
      }

      // Otherwise fetch new data
      let endpoint = searchQuery
        ? `/search/?query=${encodeURIComponent(searchQuery)}`
        : "/arts/";

      // if (user?.id) {
      //   endpoint += `${endpoint.includes("?") ? "&" : "?"}viewer_id=${user.id}`;
      // }

      const response = await fetchAPI(endpoint);
      sessionStorage.setItem(storageKey, JSON.stringify(response));
    } catch (error) {
      console.error("Failed to fetch arts: " + error.message);
    }
  }, [searchQuery, user]);

  return <ArtGallery fetchArts={cachedFetchArts} />;
};

export default MainGallery;
