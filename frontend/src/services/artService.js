import fetchAPI from "./api";

/**
 * Fetches batch art data with correct liked_by_user information based on current user
 * @param {Array} artIds - Array of art IDs to fetch
 * @param {Object} user - Current user object or null if not logged in
 * @param {string} pageKey - Key identifier for the page (e.g., 'main', 'detail', 'profile-123')
 * @returns {Array} - Updated art objects
 */
export const fetchBatchArtData = async (artIds, user, pageKey) => {
  if (!artIds || artIds.length === 0) return [];

  // Get the user ID associated with the stored arts
  const storedUserKey = `arts-${pageKey}-user`;
  const storedUserId = localStorage.getItem(storedUserKey);
  const currentUserId = user?.id || "null";

  // If user hasn't changed and we already have data, just return it
  if (storedUserId === String(currentUserId)) {
    return null; // null means no change needed
  }

  // If user has changed, fetch updated data with correct liked_by_user flags
  try {
    const response = await fetchAPI(
      currentUserId !== "null"
        ? `/arts/batch/?viewer_id=${currentUserId}`
        : `/arts/batch/`,
      "POST",
      JSON.stringify({
        art_ids: artIds,
      }),
      {
        "Content-Type": "application/json",
      }
    );

    // Update the stored user ID after successful fetch
    localStorage.setItem(storedUserKey, String(currentUserId));

    // if (response && Array.isArray(response)) {
    //   if (user?.id) {
    //     // For logged-in users, update session storage for each art
    //     response.forEach((art) => {
    //       const likeKey = `art-like-${art.id}-${user.id}`;
    //       sessionStorage.setItem(likeKey, JSON.stringify(art.liked_by_user));
    //     });
    //   } else {
    //     // For guests, don't override localStorage likes
    //     // We'll use the existing localStorage values in the useArtLikes hook
    //   }
    // }

    return response;
  } catch (error) {
    console.error("Error fetching batch art data:", error);
    return null;
  }
};

/**
 * Extracts art IDs from stored arts data
 * @param {string} storageKey - Session storage key for the arts data
 * @returns {Array} - Array of art IDs
 */
export const extractStoredArtIds = (storageKey) => {
  const storedArts = sessionStorage.getItem(storageKey);
  if (!storedArts) return [];

  try {
    const arts = JSON.parse(storedArts);
    return Array.isArray(arts) ? arts.map((art) => art.id) : [];
  } catch (e) {
    console.error("Error parsing stored arts:", e);
    return [];
  }
};
