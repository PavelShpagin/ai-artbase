import React, { useState, useEffect } from "react";
import {
  VStack,
  Image,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  useDisclosure,
  Spinner,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api";

const ArtDetailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const art = location.state?.photo;
  const { isOpen, onOpen, onClose } = useDisclosure();

  const { data: otherArts = [], isLoading } = useQuery({
    queryKey: ["similarArts", art?.id],
    queryFn: async () => {
      if (!art) return [];
      const endpoint = `/arts/similar/${art.id}`;
      const response = await fetchAPI(endpoint);
      return response.filter((image) => image.id !== art.id);
    },
    enabled: !!art,
    staleTime: 60 * 1000, // 1 minute
  });

  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location, isOpen, onClose]);

  if (!art) return null;

  return (
    <>
      <VStack
        spacing={8}
        align="center"
        paddingTop="10px"
        paddingBottom="20px"
        onClick={() => navigate(-1)}
        cursor="pointer"
      >
        <Box
          bg="gray.150"
          display="flex"
          alignItems="center"
          justifyContent="center"
          height="80vh"
          width="fit-content"
          boxShadow="2xl"
          cursor="zoom-in"
        >
          <Image
            src={art.src}
            objectFit="cover"
            borderRadius="lg"
            maxHeight="100%"
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
        <ArtGallery arts={otherArts} />
      )}
    </>
  );
};

export default ArtDetailPage;
