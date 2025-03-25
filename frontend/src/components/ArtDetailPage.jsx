import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
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

const ArtDetailPage = () => {
  const { searchQuery } = useSearchQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const [art, setArt] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const prevSearchQueryRef = useRef(searchQuery);

  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    if (location.state?.photo) {
      setArt(location.state?.photo);
    }
  }, [location.state]);

  useEffect(() => {
    setIsReady(false);
  }, [location.pathname]);

  // Navigate back when search query changes
  useEffect(() => {
    if (prevSearchQueryRef.current !== searchQuery) {
      navigate("/", { replace: true });
    }
    prevSearchQueryRef.current = searchQuery;
  }, [searchQuery, navigate]);

  useEffect(() => {
    const fetchSimilarArts = async () => {
      if (isReady) return;
      try {
        const endpoint = `/arts/similar${location.pathname}`;
        console.log(endpoint);
        if (!sessionStorage.getItem(`arts-detail-${location.pathname}`)) {
          const response = await fetchAPI(endpoint);
          console.log("response", response);
          const filteredResponse = response.filter(
            (image) => image.id !== parseInt(location.pathname.substring(1))
          );
          sessionStorage.setItem(
            `arts-detail-${location.pathname}`,
            JSON.stringify(filteredResponse)
          );
        }
        if (location.state?.photo) {
          sessionStorage.setItem(
            `art-showcase-${location.pathname}`,
            JSON.stringify(location.state.photo)
          );
        }
        if (!sessionStorage.getItem(`art-showcase-${location.pathname}`)) {
          const response = await fetchAPI(`/arts/id${location.pathname}`);
          sessionStorage.setItem(
            `art-showcase-${location.pathname}`,
            JSON.stringify(response)
          );
          setArt(response);
        } else {
          setArt(
            JSON.parse(
              sessionStorage.getItem(`art-showcase-${location.pathname}`)
            )
          );
        }
        setIsReady(true);
      } catch (error) {
        console.error("Failed to fetch similar arts: " + error.message);
      }
    };

    fetchSimilarArts();
  }, [isReady, location.pathname]);

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
      <ArtGallery isReady={isReady} />
    </>
  );
};

export default ArtDetailPage;
