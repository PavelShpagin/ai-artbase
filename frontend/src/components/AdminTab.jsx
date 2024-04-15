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

const AdminTab = () => {
  const [usersData, setUsersData] = useState([]);
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
    const updatedUsers = usersData.map((user) =>
      user.id === id ? { ...user, role: newRole } : user
    );
    setUsersData(updatedUsers);
  };

  return (
    <Box bg={bg} p={5} shadow="base" borderRadius="lg">
      <Flex direction="column" gap={6}>
        {usersData.length > 0 &&
          usersData.map((user) => (
            <Flex
              key={user.id}
              align="center"
              p={4}
              boxShadow="md"
              borderRadius="lg"
              bg="gray.50"
              justifyContent="space-between"
            >
              <Avatar name={user.username} mr={4} />
              <Box flex="1" pr={4}>
                <Flex alignItems="center" mb={2}>
                  <Text fontWeight="bold" mr={2}>
                    {user.username}
                  </Text>
                  <Badge colorScheme={user.role === "admin" ? "green" : "gray"}>
                    {user.role === "admin" ? "Admin" : "User"}
                  </Badge>
                </Flex>
                <Text fontSize="sm">{user.email}</Text>
              </Box>
              {user.id != import.meta.env.VITE_ADMIN_ID && (
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<FiMoreVertical />}
                    variant="outline"
                    aria-label="Options"
                  />
                  <MenuList>
                    <MenuItem onClick={() => changeUserRole(user.id, "user")}>
                      Set as User
                    </MenuItem>
                    <MenuItem onClick={() => changeUserRole(user.id, "admin")}>
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
