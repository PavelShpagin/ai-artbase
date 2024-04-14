import React, { useState, useEffect } from "react";
import {
  VStack,
  Image,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  useDisclosure,
} from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import ArtGallery from "./ArtGallery";
import fetchAPI from "../services/api.js";

const ArtDetailPage = () => {
  const location = useLocation();
  const art = location.state?.photo;
  const [otherArts, setOtherArts] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (!art) {
      return;
    }

    const fetchArts = async () => {
      const endpoint = "/arts/";
      try {
        const response = await fetchAPI(endpoint);
        const filteredArts = response.filter((image) => image.id !== art.id);
        console.log(filteredArts);
        setOtherArts(filteredArts);
      } catch (error) {
        console.log("There was an issue fetching arts.");
      }
    };

    fetchArts();
  }, [art.id]);

  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location]);

  return (
    <>
      <VStack spacing={8} align="center" paddingTop="10px" paddingBottom="20px">
        <Box
          bg="gray.150"
          display="flex"
          alignItems="center"
          justifyContent="center"
          height="780px"
          width="fit-content"
          boxShadow="2xl"
          onClick={onOpen}
          cursor="zoom-in"
        >
          <Image
            src={art.src}
            objectFit="cover"
            borderRadius="lg"
            maxHeight="100%"
          />
        </Box>
        <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
          <ModalOverlay />
          <ModalContent cursor="zoom-out" onClick={onClose}>
            <Image
              src={art.src}
              objectFit="contain"
              maxH="100vh"
              maxW="100vw"
            />
          </ModalContent>
        </Modal>
      </VStack>
      <ArtGallery arts={otherArts} />
    </>
  );
};

export default ArtDetailPage;
