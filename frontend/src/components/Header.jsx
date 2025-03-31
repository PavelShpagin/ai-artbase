import React, { useEffect, useState, useRef } from "react";
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
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  VStack,
  StackDivider,
  Text,
  Select,
  RadioGroup,
  Radio,
  Stack,
  RangeSlider,
  RangeSliderTrack,
  RangeSliderFilledTrack,
  RangeSliderThumb,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
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
import { FaSignInAlt, FaUser, FaCog } from "react-icons/fa";
import { MdFileUpload } from "react-icons/md";
import { useSearchQuery } from "../App";
import { BiFilterAlt, BiSearch } from "react-icons/bi";
import { useQuery } from "@tanstack/react-query";
import fetchAPI from "../services/api";
import { ChevronDownIcon } from "@chakra-ui/icons";

const UserMenu = ({ onSignOut }) => {
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, setUser } = useUser();

  const handleSignOut = () => {
    setUser(null);
    localStorage.setItem("token", "");
  };

  const handleLikedCLick = () => {
    onClose();
    navigate("/liked");
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
    if (user && user.id) {
      navigate(`/profile/${user.id}`);
    }
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
        <MenuItem icon={<FiHeart />} onClick={handleLikedCLick}>
          Liked
        </MenuItem>
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
  const prevSearchQueryRef = useRef(searchQuery);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, setUser } = useUser();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const searchBarRef = useRef(null);
  const [modalStyle, setModalStyle] = useState({});
  const navigate = useNavigate();

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["topCategories"],
    queryFn: async () => {
      const response = await fetchAPI(
        "/categories/top/",
        "GET",
        null,
        {},
        false
      );
      return response.json();
    },
  });

  const updateModalStyle = () => {
    if (searchBarRef.current) {
      const { width, left } = searchBarRef.current.getBoundingClientRect();
      setModalStyle({
        width: `${width}px`,
        left: `${left}px`,
      });
    }
  };

  useEffect(() => {
    updateModalStyle();
    window.addEventListener("resize", updateModalStyle);
    return () => window.removeEventListener("resize", updateModalStyle);
  }, []);

  useEffect(() => {
    if (isFilterOpen) {
      updateModalStyle();
    }
  }, [isFilterOpen]);

  useEffect(() => {
    if (prevSearchQueryRef.current !== searchQuery) {
      navigate("/", { replace: true });
    }
    prevSearchQueryRef.current = searchQuery;
  }, [searchQuery, navigate]);

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
        <RouterLink
          onClick={() => {
            setSearchQuery("");
            window.scrollTo(0, 0);
            sessionStorage.setItem("scrollPosition-main-", "0");
          }}
          to="/"
          style={{ textDecoration: "none" }}
        >
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
          position="relative"
          ref={searchBarRef}
        >
          <InputLeftElement pointerEvents="none" zIndex="1">
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
            pr="40px"
          />

          <Box
            position="absolute"
            pt={2}
            right="4"
            top="50%"
            transform="translateY(-50%) scale(1.1)"
            cursor="pointer"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <Icon as={BiFilterAlt} color="rgb(173, 179, 204)" boxSize={5} />
          </Box>

          {/* Categories Modal */}
          <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)}>
            <ModalOverlay />
            <ModalContent
              style={{
                ...modalStyle,
                position: "absolute",
                top: "5px", // Adjust as needed
              }}
              maxW="none"
            >
              <ModalBody>
                <Flex flexWrap="wrap" gap={2} my={2} justifyContent="center">
                  {categories?.map((category) => (
                    <Button
                      key={category.name}
                      size="sm"
                      variant="outline"
                      borderRadius="full"
                      onClick={() => {
                        setSearchQuery(category.name);
                        navigate(
                          `/?search=${encodeURIComponent(category.name)}`,
                          {
                            replace: false,
                            state: { searchQuery: category.name },
                          }
                        );
                        setIsFilterOpen(false);
                      }}
                    >
                      {category.name}
                    </Button>
                  ))}
                </Flex>
              </ModalBody>
            </ModalContent>
          </Modal>
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
