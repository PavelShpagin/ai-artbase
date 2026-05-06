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
import HeroBanner from "./HeroBanner";
import TierToggle from "./TierToggle";
import PaywallModal from "./PaywallModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.aiartbase.com";

const MainGallery = () => {
  const { searchQuery, setSearchQuery, uiSearchQuery, setUiSearchQuery } =
    useSearchQuery();
  const { user } = useUser();
  const prevSearchQueryRef = useRef(searchQuery);
  const location = useLocation();
  const prevUserRef = useRef(user);
  const [visibleArts, setVisibleArts] = useState([]);
  const [arts, setArts] = useState([]);
  const [tier, setTier] = useState("curated");
  const [isPro, setIsPro] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Check pro status when user changes
  useEffect(() => {
    if (!user?.id) { setIsPro(false); return; }
    fetch(`${API_BASE}/credits/balance/${user.id}`)
      .then((r) => r.json()).then((d) => setIsPro(!!d.is_pro)).catch(() => {});
  }, [user?.id]);

  useLayoutEffect(() => {
    const handlePopState = (e) => {
      const query = e?.state?.state || "";
      setSearchQuery(query);
      setUiSearchQuery(query);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const cachedFetchArts = useCallback(async () => {
    try {
      // if (prevSearchQueryRef.current.length === 0 && searchQuery.length === 1) {
      //   window.history.pushState({ state: searchQuery }, "", "/");
      // } else if (
      //   prevSearchQueryRef.current.length === 1 &&
      //   searchQuery.length === 0
      // ) {
      //   window.history.popState();
      // } else {
      //   window.history.replaceState({ state: searchQuery }, "", "/");
      // }

      prevSearchQueryRef.current = searchQuery;

      const storageKey = `arts-main-${tier}-${searchQuery}`;

      // Check if we need to update likes information due to user change
      if (
        user?.id !== prevUserRef.current?.id &&
        localStorage.getItem(storageKey)
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
            // Update localStorage with new data
            localStorage.setItem(storageKey, JSON.stringify(updatedArts));

            // important
            // const visibleArtsKey = `visibleArts-main-${searchQuery}`;
            // const visibleArtsCount = localStorage.getItem(visibleArtsKey)
            //   ? JSON.parse(localStorage.getItem(visibleArtsKey)).length
            //   : 0;
            // localStorage.setItem(
            //   visibleArtsKey,
            //   JSON.stringify(updatedArts.slice(0, visibleArtsCount))
            // );
          }
        }
      }

      // Update previous user reference
      prevUserRef.current = user;

      // If we already have the data in localStorage, return
      if (localStorage.getItem(storageKey)) {
        return;
      }

      // Otherwise fetch new data
      let endpoint = searchQuery
        ? `/arts/search/?query=${encodeURIComponent(searchQuery)}&tier=${tier}`
        : `/arts/?tier=${tier}&limit=100`;
      if (user?.id) {
        endpoint += `&viewer_id=${user.id}`;
      }

      try {
        const response = await fetchAPI(endpoint);
        localStorage.setItem(storageKey, JSON.stringify(response));
      } catch (err) {
        // 402 = pro required for premium tier; show paywall + revert
        if (/Premium gallery requires|pro_required|402/i.test(err.message || "")) {
          setPaywallOpen(true);
          setTier("curated");
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error("Failed to fetch arts: " + error.message);
    }
  }, [searchQuery, user, tier]);

  // When tier changes, drop visible state so gallery refetches
  useEffect(() => {
    setVisibleArts([]);
    setArts([]);
  }, [tier]);

  return (
    <div>
      {!searchQuery && <HeroBanner />}
      <TierToggle
        tier={tier}
        onChange={setTier}
        isPro={isPro}
        onPremiumDenied={() => setPaywallOpen(true)}
      />
      <ArtGallery
        fetchArts={cachedFetchArts}
        visibleArts={visibleArts}
        setVisibleArts={setVisibleArts}
        arts={arts}
        setArts={setArts}
      />
      <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
};

export default MainGallery;
