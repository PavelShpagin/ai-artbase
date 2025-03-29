import React, { useEffect, useState, useCallback } from "react";
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
//import { useAuthRedirect } from "../hooks/useAuthRedirect";

const UserProfile = () => {
  const { id } = useParams(); // Extract id from URL
  const [user, setUser] = useState(null);
  //useAuthRedirect();

  const textColor = useColorModeValue("gray.800", "white");

  const fetchArts = useCallback(async () => {
    if (id) {
      const pathKey = `profile-${id}`;
      const storedArts = sessionStorage.getItem(`arts-${pathKey}`);

      if (storedArts) {
        return;
      }

      const data = await fetchAPI(`/arts/${id}`, "GET");
      sessionStorage.setItem(`arts-${pathKey}`, JSON.stringify(data));
    }
  }, [id]);

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
