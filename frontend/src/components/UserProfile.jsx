import React, { useEffect, useState } from "react";
import {
  Box,
  Avatar,
  Flex,
  Text,
  useColorModeValue,
  Grid,
  Image,
  VStack,
} from "@chakra-ui/react";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useUser } from "../contexts/UserContext";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

const UserProfile = () => {
  const { user, setUser } = useUser();
  const [images, setImages] = useState([]);
  useAuthRedirect();

  const textColor = useColorModeValue("gray.800", "white");

  useEffect(() => {
    const fetchArts = async () => {
      if (user && user.id) {
        const data = await fetchAPI(`/arts/${user.id}`, "GET");
        setImages(data);
        console.log(data);
      }
    };
    fetchArts();
  }, [user]);

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
        {images.length > 0 ? (
          <ArtGallery arts={images} />
        ) : (
          <Box textAlign="center" w="full" p={10}>
            <Text fontSize="xl" color={textColor} fontWeight="500">
              You didn't upload any images yet...
            </Text>
          </Box>
        )}
      </Box>
    </VStack>
  );
};

export default UserProfile;
