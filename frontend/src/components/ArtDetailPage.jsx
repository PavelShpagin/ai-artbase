import React, {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  VStack,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  useDisclosure,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";
import { Spinner } from "@chakra-ui/react";
import { fetchBatchArtData, extractStoredArtIds } from "../services/artService";
import { useUser } from "../contexts/UserContext";

const ArtDetailPage = () => {
  const { searchQuery } = useSearchQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const [art, setArt] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user } = useUser();
  const prevUserRef = useRef(null);

  const [isReady, setIsReady] = useState(false);

  const fetchSimilarArts = useCallback(async () => {
    try {
      const storageKey = `arts-detail-${location.pathname}`;

      // Check if user has changed and we need to update likes
      if (
        user?.id !== prevUserRef.current?.id &&
        sessionStorage.getItem(storageKey)
      ) {
        const artIds = extractStoredArtIds(storageKey);

        if (artIds.length > 0) {
          const updatedArts = await fetchBatchArtData(
            artIds,
            user,
            `detail-${location.pathname}`
          );

          if (updatedArts) {
            console.log("updatedArts", updatedArts);
            sessionStorage.setItem(storageKey, JSON.stringify(updatedArts));
            // Update visibleArts in sessionStorage with first batch of updatedArts
            const visibleArtsKey = `visibleArts-detail-${location.pathname}`;
            const visibleArtsCount = sessionStorage.getItem(visibleArtsKey)
              ? JSON.parse(sessionStorage.getItem(visibleArtsKey)).length
              : 0;
            sessionStorage.setItem(
              visibleArtsKey,
              JSON.stringify(updatedArts.slice(0, visibleArtsCount))
            );
          }
        }
      }

      // Update previous user reference
      prevUserRef.current = user;

      // Continue with normal fetch if data isn't in session storage
      if (!sessionStorage.getItem(storageKey)) {
        const endpoint = `/arts/similar${location.pathname}${
          user?.id ? `?viewer_id=${user.id}` : ""
        }`;
        const response = await fetchAPI(endpoint);
        const filteredResponse = response.filter(
          (image) => image.id !== parseInt(location.pathname.substring(1))
        );
        sessionStorage.setItem(storageKey, JSON.stringify(filteredResponse));

        // Store current user ID
        localStorage.setItem(
          `arts-detail-${location.pathname}-user`,
          user?.id || "null"
        );
      }
    } catch (error) {
      console.error("Failed to fetch similar arts: " + error.message);
    }
  }, [location.pathname, user]);

  useLayoutEffect(() => {
    const fetchArt = async () => {
      if (location.state?.photo) {
        sessionStorage.setItem(
          `art-showcase-${location.pathname}`,
          JSON.stringify(location.state.photo)
        );
        setArt(location.state?.photo);
        return;
      }
      if (!sessionStorage.getItem(`art-showcase-${location.pathname}`)) {
        const endpoint = `/arts/id${location.pathname}${
          user?.id ? `?viewer_id=${user.id}` : ""
        }`;
        const response = await fetchAPI(endpoint);
        sessionStorage.setItem(
          `art-showcase-${location.pathname}`,
          JSON.stringify(response)
        );

        // Store current user ID
        localStorage.setItem(
          `art-showcase-${location.pathname}-user`,
          user?.id || "null"
        );
        setArt(response);
      } else {
        // Check if user changed and we need to update like status
        const showcaseKey = `art-showcase-${location.pathname}`;
        const storedUserId = localStorage.getItem(`${showcaseKey}-user`);

        if (storedUserId !== String(user?.id || "null")) {
          const artData = JSON.parse(sessionStorage.getItem(showcaseKey));

          if (artData?.id) {
            const updatedArt = await fetchBatchArtData(
              [artData.id],
              user,
              `showcase-${location.pathname}`
            );

            if (updatedArt && updatedArt.length > 0) {
              sessionStorage.setItem(
                showcaseKey,
                JSON.stringify(updatedArt[0])
              );
              setArt(updatedArt[0]);
              return;
            }
          }
        }

        setArt(JSON.parse(sessionStorage.getItem(showcaseKey)));
      }
    };

    setArt(null);
    fetchArt();
  }, [location.pathname, user]);

  // Close modal when location changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location]);

  // Function to go back
  const goBack = () => {
    navigate(-1);
  };

  //if (!art) return null;

  return (
    <>
      <VStack
        spacing={8}
        align="center"
        paddingTop="10px"
        paddingBottom="20px"
        onClick={goBack}
        cursor="pointer"
      >
        <Box
          bg="gray.150"
          display="flex"
          alignItems="center"
          justifyContent="center"
          height={{ base: "50vh", md: "80vh" }}
          width="fit-content"
          maxWidth="80vw"
        >
          {art ? (
            <OptimizedImage
              src={art.src}
              objectFit="cover"
              borderRadius="lg"
              maxHeight="100%"
              boxShadow="2xl"
              cursor="zoom-in"
              onClick={(e) => {
                e.stopPropagation(); // Prevents the VStack onClick from firing
                onOpen();
              }}
            />
          ) : (
            <Box display="flex" justifyContent="center" py={4} width="100%">
              <Spinner size="md" thickness="4px" color="gray.200" />
            </Box>
          )}
        </Box>
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          size="full"
          cursor="pointer"
          isCentered
        >
          <ModalOverlay />
          <ModalContent
            cursor="zoom-out"
            onClick={(e) => {
              e.stopPropagation(); // Prevents the VStack onClick from firing
              onClose();
            }}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {art && (
              <OptimizedImage
                src={art.src}
                objectFit="contain"
                maxH="100vh"
                maxW="100vw"
              />
            )}
          </ModalContent>
        </Modal>
      </VStack>
      <ArtGallery fetchArts={fetchSimilarArts} setArt={setArt} />
    </>
  );
};

export default ArtDetailPage;
