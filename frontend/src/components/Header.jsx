import React, { useEffect, useState } from "react";
import {
  Icon,
  Box,
  Flex,
  InputGroup,
  InputLeftElement,
  Input,
  Link,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
  Button,
  useDisclosure,
  MenuDivider,
  useColorModeValue,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import {
  FiUser,
  FiHeart,
  FiBarChart2,
  FiUsers,
  FiLogOut,
  FiTrello,
} from "react-icons/fi";
import { MdHistory } from "react-icons/md";
import PurpleButton from "./Buttons";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import SignInModal from "./SignInModal";
import { useUser } from "../contexts/UserContext";
import { FaSignInAlt } from "react-icons/fa";
import { MdFileUpload } from "react-icons/md";
import { useSearchQuery } from "../App";

const UserMenu = ({ onSignOut }) => {
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, setUser } = useUser();

  const handleSignOut = () => {
    setUser(null);
    localStorage.setItem("token", "");
  };

  const handleAnalyticsClick = () => {
    onClose();
    navigate("/analytics");
  };

  const handleAdminCLick = () => {
    onClose();
    navigate("/admin");
  };

  const handleProfileCLick = () => {
    onClose();
    navigate("/profile");
  };

  return (
    <Menu isOpen={isOpen} onClose={onClose}>
      <MenuButton
        as={Button}
        variant="invisible"
        onClick={onOpen}
        p={0}
        minW={0}
      >
        <Avatar name={user.username} size="md" src={user.picture} />
      </MenuButton>
      <MenuList>
        {user.role === "admin" && (
          <MenuItem icon={<FiTrello />} onClick={handleAdminCLick}>
            Admin Tab
          </MenuItem>
        )}
        <MenuItem icon={<FiUser />} onClick={handleProfileCLick}>
          Profile
        </MenuItem>
        {/*<MenuItem icon={<MdHistory />}>History</MenuItem>*/}
        {/*<MenuItem icon={<FiHeart />}>Liked</MenuItem>*/}
        <MenuItem icon={<FiBarChart2 />} onClick={handleAnalyticsClick}>
          Analytics
        </MenuItem>
        {/*<MenuItem icon={<FiUsers />}>Followers</MenuItem>*/}
        <MenuDivider m={0} />
        <MenuItem icon={<FiLogOut />} onClick={handleSignOut}>
          Sign out
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

const Header = () => {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useSearchQuery();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, setUser } = useUser();

  const handleSignInClick = () => setIsSignInModalOpen(true);
  const handleSignInModalClose = () => setIsSignInModalOpen(false);

  const handleUploadClick = () => {
    document.getElementById("file-upload").click();
  };

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bg={useColorModeValue("white", "gray.800")}
      p={3}
      boxShadow="sm"
      borderBottomWidth="1px"
      borderBottomColor={useColorModeValue("gray.200", "gray.900")}
      zIndex="sticky"
    >
      <Flex
        align="center"
        justify="space-between"
        wrap="wrap"
        mx="auto"
        px={{ base: 2, md: 4 }}
        gap={10}
      >
        <RouterLink to="/" style={{ textDecoration: "none" }}>
          <Box display={{ base: "none", md: "flex" }}>
            <div className="ai-artbase-logo">Ai ArtBase</div>
          </Box>
          <Box display={{ base: "flex", md: "none" }}>
            <div className="ai-artbase-logo">A</div>
          </Box>
        </RouterLink>

        <InputGroup
          size="lg"
          w="auto"
          flex="1"
          flexGrow={1}
          marginX="auto"
          maxW="600px"
        >
          <InputLeftElement pointerEvents="none">
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>
          <Input
            variant="filled"
            bg={useColorModeValue("gray.50", "gray.700")}
            _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}
            _focus={{ borderColor: "purple.500" }}
            placeholder="Search for AI images"
            borderRadius="full"
            boxShadow="base"
            fontWeight="500"
            color="gray.600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <Flex align="center" gap={2}>
          {localStorage.getItem("token") ? (
            user && (
              <>
                <Box display={{ base: "none", md: "flex" }}>
                  <PurpleButton name="Upload" onClick={handleUploadClick} />
                </Box>
                <Box display={{ base: "flex", md: "none" }} px={1}>
                  <PurpleButton
                    name={<MdFileUpload />}
                    onClick={handleUploadClick}
                    px={2}
                    py={1}
                  />
                </Box>
                <UserMenu user={user} setUser={setUser} />
              </>
            )
          ) : (
            <>
              <Box display={{ base: "none", md: "flex" }}>
                <PurpleButton name="Sign In" onClick={handleSignInClick} />
              </Box>
              <Box display={{ base: "flex", md: "none" }} px={1}>
                <PurpleButton
                  name={<FaSignInAlt />}
                  onClick={handleSignInClick}
                  px={2}
                  py={1}
                />
              </Box>
            </>
          )}
        </Flex>
      </Flex>
      <SignInModal
        setUser={setUser}
        isOpen={isSignInModalOpen}
        onClose={handleSignInModalClose}
      />
    </Box>
  );
};

export default Header;
