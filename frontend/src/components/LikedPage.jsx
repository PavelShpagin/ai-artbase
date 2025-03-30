import React, { useCallback, useRef } from "react";
import { Box, Heading, Text, Flex, Icon } from "@chakra-ui/react";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";
import { useUser } from "../contexts/UserContext";
import { FiHeart } from "react-icons/fi";
import { fetchBatchArtData, extractStoredArtIds } from "../services/artService";

const LikedPage = () => {
  const { searchQuery } = useSearchQuery();
  const { user } = useUser();
  const prevUserRef = useRef(null);

  // Fetch liked arts for the current user
  const fetchLikedArts = useCallback(async () => {
    try {
      if (!user?.id) return;

      const pathKey = `liked-${user.id}`;
      const storageKey = `arts-${pathKey}`;

      // Since this is a user-specific page, we don't need to check for user changes
      // as the page itself is tied to a specific user

      // Check if we already have the data in session storage
      if (sessionStorage.getItem(storageKey)) {
        return;
      }

      // Build the endpoint with appropriate parameters
      const endpoint = `/arts/likes/${user.id}?viewer_id=${user.id}`;
      // Fetch the liked arts
      const response = await fetchAPI(endpoint, "GET");

      // Store in session storage
      sessionStorage.setItem(storageKey, JSON.stringify(response));

      // Store current user ID
      localStorage.setItem(`${storageKey}-user`, user.id);
    } catch (error) {
      console.error("Failed to fetch liked arts:", error.message);
    }
  }, [user]);

  return (
    <Box pt="80px" px={{ base: 4, md: 8 }}>
      <Flex
        direction="column"
        align="center"
        mb={6}
        bg="purple.50"
        borderRadius="lg"
        p={6}
        boxShadow="sm"
        maxW="800px"
        mx="auto"
      >
        <Flex align="center" mb={2}>
          <Icon as={FiHeart} color="purple.500" fontSize="24px" mr={2} />
          <Heading size="lg" color="gray.700" fontWeight="600">
            Your Liked AI Images
          </Heading>
        </Flex>
        <Text color="gray.500" textAlign="center">
          Browse through all the AI-generated images you've liked
        </Text>
      </Flex>

      <ArtGallery fetchArts={fetchLikedArts} />
    </Box>
  );
};

export default LikedPage;
