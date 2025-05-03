import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  Avatar,
  Flex,
  Text,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useParams } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { fetchBatchArtData, extractStoredArtIds } from "../services/artService";
//import { useAuthRedirect } from "../hooks/useAuthRedirect";

const UserProfile = () => {
  const { id } = useParams(); // Extract id from URL
  const [user, setUser] = useState(null);
  const { user: currentUser } = useUser();
  const prevUserRef = useRef(null);
  //useAuthRedirect();

  const textColor = useColorModeValue("gray.800", "white");

  const fetchArts = useCallback(async () => {
    if (id) {
      const pathKey = `profile-${id}`;
      const storageKey = `arts-${pathKey}`;

      // Check if user has changed and we need to update likes
      if (
        currentUser?.id !== prevUserRef.current?.id &&
        localStorage.getItem(storageKey)
      ) {
        const artIds = extractStoredArtIds(storageKey);

        if (artIds.length > 0) {
          const updatedArts = await fetchBatchArtData(
            artIds,
            currentUser,
            pathKey
          );

          if (updatedArts) {
            localStorage.setItem(storageKey, JSON.stringify(updatedArts));
            // Update visibleArts in localStorage with first batch of updatedArts
            const visibleArtsKey = `visibleArts-profile-${id}`;
            const visibleArtsCount = localStorage.getItem(visibleArtsKey)
              ? JSON.parse(localStorage.getItem(visibleArtsKey)).length
              : 0;
            localStorage.setItem(
              visibleArtsKey,
              JSON.stringify(updatedArts.slice(0, visibleArtsCount))
            );
          }
        }
      }

      // Update previous user reference
      prevUserRef.current = currentUser;

      // If we don't have data in localStorage, fetch it
      if (!localStorage.getItem(storageKey)) {
        const endpoint = `/arts/${id}${
          currentUser?.id ? `?viewer_id=${currentUser.id}` : ""
        }`;
        const data = await fetchAPI(endpoint, "GET");
        localStorage.setItem(storageKey, JSON.stringify(data));

        // Store current user ID
        localStorage.setItem(`${storageKey}-user`, currentUser?.id || "null");
      }
    }
  }, [id, currentUser]);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await fetchAPI(`/users/${id}`, "GET");
      console.log("userData", userData);
      setUser(userData);
    };

    fetchUser();
  }, [id]);

  return (
    <VStack spacing={0} align="center" minH="100vh" m={0}>
      {user && (
        <Flex direction="column" align="center" p={20} flexShrink={0}>
          <Avatar size="2xl" name={user.username} src={user.picture} mb={4} />
          <Text fontSize="2xl" fontWeight="bold" color={textColor}>
            {user.username}
          </Text>
          <Text fontSize="md" color="gray.500">
            {user.email}
          </Text>
        </Flex>
      )}
      <Box
        flex="1"
        w="full"
        overflowY="auto"
        pt={3}
        borderRadius="lg"
        bg="gray.50"
      >
        <ArtGallery fetchArts={fetchArts} />
      </Box>
    </VStack>
  );
};

export default UserProfile;
