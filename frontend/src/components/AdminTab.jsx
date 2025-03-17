import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Avatar,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiMoreVertical } from "react-icons/fi";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import fetchAPI from "../services/api";
import { useUser } from "../contexts/UserContext";

const AdminTab = () => {
  const [usersData, setUsersData] = useState([]);
  const { user, setUser } = useUser();

  useAuthRedirect();

  const bg = useColorModeValue("white", "gray.800");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetchAPI("/users");
        console.log(response);
        setUsersData(response);
      } catch (error) {
        console.error("Failed to fetch arts:", error);
      }
    };
    fetchUsers();
  }, []);

  const changeUserRole = async (id, newRole) => {
    const response = await fetchAPI(
      "/users/",
      "PATCH",
      JSON.stringify({ user_id: id, role: newRole }),
      {
        "Content-Type": "application/json",
      }
    );
    const updatedUsers = usersData.map((userData) =>
      userData.id === id ? { ...userData, role: newRole } : userData
    );
    setUsersData(updatedUsers);
  };

  return (
    <Box bg={bg} p={5} shadow="base" borderRadius="lg">
      <Flex direction="column" gap={6}>
        {usersData.length > 0 &&
          usersData.map((userData) => (
            <Flex
              key={userData.id}
              align="center"
              p={4}
              boxShadow="md"
              borderRadius="lg"
              bg="gray.50"
              justifyContent="space-between"
            >
              <Avatar name={userData.username} mr={4} />
              <Box flex="1" pr={4}>
                <Flex alignItems="center" mb={2}>
                  <Text fontWeight="bold" mr={2}>
                    {userData.username}
                  </Text>
                  <Badge
                    colorScheme={userData.role === "admin" ? "green" : "gray"}
                  >
                    {userData.role === "admin" ? "Admin" : "User"}
                  </Badge>
                </Flex>
                <Text fontSize="sm">{userData.email}</Text>
              </Box>
              {user &&
                userData.id != import.meta.env.VITE_ADMIN_ID &&
                userData.id != user.id && (
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<FiMoreVertical />}
                      variant="outline"
                      aria-label="Options"
                    />
                    <MenuList>
                      <MenuItem
                        onClick={() => changeUserRole(userData.id, "user")}
                      >
                        Set as User
                      </MenuItem>
                      <MenuItem
                        onClick={() => changeUserRole(userData.id, "admin")}
                      >
                        Set as Admin
                      </MenuItem>
                    </MenuList>
                  </Menu>
                )}
            </Flex>
          ))}
      </Flex>
    </Box>
  );
};

export default AdminTab;
