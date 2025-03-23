import React, { useEffect, useRef, useState } from "react";
import {
  VStack,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  useDisclosure,
} from "@chakra-ui/react";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";
import { Spinner } from "@chakra-ui/react";

const ArtDetailPage = () => {
  const { searchQuery } = useSearchQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const art = location.state?.photo;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const prevSearchQueryRef = useRef(searchQuery);

  // Navigate back when search query changes
  useEffect(() => {
    if (prevSearchQueryRef.current !== searchQuery) {
      navigate("/", { replace: true });
    }
    prevSearchQueryRef.current = searchQuery;
  }, [searchQuery, navigate]);

  // Fetch similar arts
  const { data: similarArts, isLoading } = useQuery({
    queryKey: ["similar", art?.id],
    queryFn: async () => {
      const endpoint = `/arts/similar/${art.id}`;
      const response = await fetchAPI(endpoint);
      const filteredResponse = response.filter((image) => image.id !== art.id);
      console.log("!filteredResponse", filteredResponse);
      return filteredResponse;
    },
    enabled: !!art?.id,
    staleTime: Infinity, // 5 minutes
    cacheTime: Infinity, // 10 minutes
  });

  // Close modal when location changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location]);

  // Function to go back
  const goBack = () => {
    router.history.back();
  };

  if (!art) return null;

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
            <Image
              src={art.src}
              objectFit="contain"
              maxH="100vh"
              maxW="100vw"
            />
          </ModalContent>
        </Modal>
      </VStack>
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4} width="100%">
          <Spinner size="md" thickness="4px" color="gray.200" />
        </Box>
      ) : (
        <ArtGallery arts={similarArts} />
      )}
    </>
  );
};

export default ArtDetailPage;
