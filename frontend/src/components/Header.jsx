import React, { useState } from "react";
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
} from "react-icons/fi";
import { MdHistory } from "react-icons/md";
import PurpleButton from "./Buttons";
import { useNavigate } from "react-router-dom";
import SignInModal from "./SignInModal";

const UserMenu = ({ user, setUser, onSignOut }) => {
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const handleAnalyticsClick = () => {
    onClose();
    navigate("/analytics");
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
        <Avatar size="md" src={user.picture} />
      </MenuButton>
      <MenuList>
        <MenuItem icon={<FiUser />}>Profile</MenuItem>
        <MenuItem icon={<MdHistory />}>History</MenuItem>
        <MenuItem icon={<FiHeart />}>Liked</MenuItem>
        <MenuItem icon={<FiBarChart2 />} onClick={handleAnalyticsClick}>
          Analytics
        </MenuItem>
        <MenuItem icon={<FiUsers />}>Followers</MenuItem>
        <MenuDivider m={0} />
        <MenuItem icon={<FiLogOut />} onClick={handleSignOut}>
          Sign out
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

const Header = ({ user, setUser, onUploadClick, onSearchChange }) => {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const searchInputBg = useColorModeValue("gray.50", "gray.700");

  const handleSignInClick = () => setIsSignInModalOpen(true);
  const handleSignInModalClose = () => setIsSignInModalOpen(false);

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
        <Link href="/" _hover={{ textDecoration: "none" }}>
          <Box>
            <div className="ai-artbase-logo">Ai ArtBase</div>
          </Box>
        </Link>

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
            onKeyDown={onSearchChange}
          />
        </InputGroup>
        <Flex align="center" gap={2}>
          {user ? (
            <>
              <PurpleButton name="Upload" onClick={onUploadClick} />
              <UserMenu user={user} setUser={setUser} />
            </>
          ) : (
            <PurpleButton name="Sign In" onClick={handleSignInClick} />
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
