import { useState, useEffect, useCallback } from "react";
import fetchAPI from "../services/api";

/**
 * Custom hook for managing liked status of arts using storage
 *
 * @param {number} artId - ID of the art piece
 * @param {Object} user - Current user object
 * @param {boolean} initialLikedStatus - Initial liked status from API
 * @returns {[boolean, Function]} - Liked status and toggle function
 */
const useArtLikes = (artId, user, initialLikedStatus = false) => {
  // State to track if the art is liked
  const [isLiked, setIsLiked] = useState(false);

  // Effect to initialize the like state
  useEffect(() => {
    if (!artId) return;

    if (user?.id) {
      // For logged-in users, use the API-provided liked status
      setIsLiked(initialLikedStatus);
    } else {
      // For guests, check localStorage
      const likedFromStorage = localStorage.getItem(`like-${artId}`) === "true";
      setIsLiked(likedFromStorage);
    }
  }, [artId, initialLikedStatus, user]);

  // Function to toggle like status
  const toggleLike = useCallback(
    async (e) => {
      // Prevent event propagation if event exists
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }

      const newLikedState = !isLiked;

      if (user) {
        // Purge cache for arts-liked, visiblearts-liked, page-liked, scrollposition-liked, etc.
        const localCacheKeys = [`arts-liked-${user.id}`];

        const sessionCacheKeys = [
          `page-liked-${user.id}`,
          `scrollPosition-liked-${user.id}`,
          `layoutHeight-liked-${user.id}`,
        ];

        // Instead of removing liked art collection, we'll upsert it
        const likedKey = `arts-liked-${user.id}`;
        let likedArts = [];

        try {
          // Get current liked arts
          const likedArtsJson = localStorage.getItem(likedKey);
          if (likedArtsJson) {
            likedArts = JSON.parse(likedArtsJson);
          }
        } catch (error) {
          console.error("Error parsing liked arts:", error);
        }

        // Remove the liked key from purge list
        const filteredLocalKeys = localCacheKeys.filter(
          (key) => key !== likedKey
        );

        // Purge other cache keys
        filteredLocalKeys.forEach((key) => {
          localStorage.removeItem(key);
        });

        sessionCacheKeys.forEach((key) => {
          sessionStorage.removeItem(key);
        });
      }

      try {
        // Update UI state immediately for better UX
        setIsLiked(newLikedState);

        // Determine endpoint based on new state
        const endpoint = newLikedState
          ? `/arts/like/${artId}`
          : `/arts/unlike/${artId}`;

        // Add user_id to query if logged in
        const queryString = user?.id ? `?user_id=${user.id}` : "";

        // console.log("endpoint", endpoint);
        // Call API to update like status
        await fetchAPI(`${endpoint}${queryString}`, "POST");

        if (user?.id) {
          // For logged-in users, update all instances in localStorage
          updateAllArtInstancesInStorage(artId, user.id, newLikedState);

          // Additionally, update the liked arts collection with an upsert operation
          const likedKey = `arts-liked-${user.id}`;
          let likedArts = [];

          try {
            // Get current liked arts
            const likedArtsJson = localStorage.getItem(likedKey);
            if (likedArtsJson) {
              likedArts = JSON.parse(likedArtsJson);
            }

            if (newLikedState) {
              // Like operation - find the art in other collections
              let artDetails = null;

              // Search for art details in other collections
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith("arts-") && !key.startsWith("arts-liked-")) {
                  try {
                    const arts = JSON.parse(localStorage.getItem(key));
                    if (Array.isArray(arts)) {
                      const foundArt = arts.find((art) => art.id === artId);
                      if (foundArt) {
                        artDetails = foundArt;
                        break;
                      }
                    }
                  } catch (error) {
                    console.error(`Error searching art in ${key}:`, error);
                  }
                }
              }

              if (artDetails) {
                // Check if art already exists in liked collection
                const artIndex = likedArts.findIndex((art) => art.id === artId);

                if (artIndex >= 0) {
                  // Update existing entry
                  likedArts[artIndex] = {
                    ...artDetails,
                    liked_by_user: true,
                  };
                } else {
                  // Add new entry
                  likedArts.unshift({
                    ...artDetails,
                    liked_by_user: true,
                  });
                }

                // Save updated collection
                localStorage.setItem(likedKey, JSON.stringify(likedArts));
              }
            } else {
              // Unlike operation - remove from liked collection
              const filteredArts = likedArts.filter((art) => art.id !== artId);
              localStorage.setItem(likedKey, JSON.stringify(filteredArts));
            }
          } catch (error) {
            console.error("Error updating liked arts collection:", error);
          }
        } else {
          // For guests, use localStorage
          if (newLikedState) {
            localStorage.setItem(`like-${artId}`, "true");
          } else {
            localStorage.removeItem(`like-${artId}`);
          }
        }
      } catch (error) {
        // Revert state on error
        console.error("Error toggling like:", error);
        setIsLiked(!newLikedState);
      }
    },
    [artId, isLiked, user]
  );

  return [isLiked, toggleLike];
};

/**
 * Updates like status for an art across all session storage instances
 */
function updateAllArtInstancesInStorage(artId, userId, isLiked) {
  // First, update the specific like key for this art
  //   const likeKey = `art-like-${artId}-${userId || "guest"}`;
  //   localStorage.setItem(likeKey, JSON.stringify(isLiked));

  // Then update all places where this art appears in collections
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key.startsWith("arts-") ||
      // important
      //key.startsWith("visibleArts-") ||
      key.startsWith("art-")
    ) {
      try {
        const storedArts = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(storedArts)) {
          let updated = false;
          const updatedArts = storedArts.map((art) => {
            if (art.id === artId) {
              updated = true;
              return { ...art, liked_by_user: isLiked };
            }
            return art;
          });

          if (updated) {
            localStorage.setItem(key, JSON.stringify(updatedArts));
          }
        }
      } catch (error) {
        console.error(`Error updating art in storage (${key}):`, error);
      }
    }
  }
}

export default useArtLikes;
