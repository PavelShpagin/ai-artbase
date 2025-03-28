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

const MainGallery = () => {
  const { searchQuery, setSearchQuery } = useSearchQuery();
  const prevSearchQueryRef = useRef(searchQuery);
  const location = useLocation();

  useLayoutEffect(() => {
    window.addEventListener("popstate", (e) => {
      console.log("e.state.state", e.state.state);
      const query = e.state.state || "";
      if (query !== searchQuery) {
        setSearchQuery(query);
      }
    });

    return () => {
      window.removeEventListener("popstate", (e) => {
        console.log("e.state", e.state);
      });
    };
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

      if (sessionStorage.getItem(`arts-main-${searchQuery}`)) {
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
    } catch (error) {
      console.error("Failed to fetch arts: " + error.message);
    }
  }, [searchQuery]);

  return <ArtGallery fetchArts={cachedFetchArts} />;
};

export default MainGallery;
