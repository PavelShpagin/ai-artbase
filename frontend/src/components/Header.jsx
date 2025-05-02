// src/components/Header.js
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
  IconButton,
  useBreakpointValue,
  Tooltip,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import {
  FiUser,
  FiHeart,
  FiBarChart2,
  FiUsers,
  FiLogOut,
  FiTrello,
  FiUpload,
  FiCpu,
  FiHome,
} from "react-icons/fi";
import { MdHistory } from "react-icons/md";
import PurpleButton from "./Buttons"; // Make sure path is correct
import { useNavigate, Link as RouterLink } from "react-router-dom";
import SignInModal from "./SignInModal"; // Make sure path is correct
import { useUser } from "../contexts/UserContext"; // Make sure path is correct
import { FaSignInAlt, FaUser, FaCog } from "react-icons/fa";
import { MdFileUpload } from "react-icons/md";
import { useSearchQuery } from "../App"; // Make sure path is correct
import { BiFilterAlt, BiSearch } from "react-icons/bi";
import { useQuery } from "@tanstack/react-query";
import fetchAPI from "../services/api"; // Make sure path is correct
import { ChevronDownIcon } from "@chakra-ui/icons";

// --- UserMenu Component remains the same ---
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
        variant="unstyled" // Use unstyled to prevent default button styles interfering
        onClick={onOpen}
        p={0}
        minW={0}
        h="auto" // Adjust height
      >
        {/* Ensure Avatar fits well */}
        <Avatar
          name={user?.username || "User"} // Add fallback name
          size="md"
          src={user?.picture} // Check if picture exists
          border="2px solid transparent" // Add transparent border initially
          _hover={{ borderColor: "purple.300" }} // Optional hover effect
        />
      </MenuButton>
      <MenuList>
        {/* Check if user and user.role exist before accessing */}
        {user?.role === "admin" && (
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
// --- UserMenu Component ends ---

// --- BottomNavigation Component Definition ---
const BottomNavigation = ({ onUploadClick, onGenerateClick }) => {
  const navigate = useNavigate();
  const { setSearchQuery, setUiSearchQuery } = useSearchQuery(); // Get search setters

  const handleHomeClick = () => {
    setSearchQuery(""); // Clear search on home navigation
    setUiSearchQuery("");
    window.scrollTo(0, 0);
    sessionStorage.setItem("scrollPosition-main-", "0");
    navigate("/");
  };

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg={useColorModeValue("white", "gray.800")}
      borderTopWidth="1px"
      borderTopColor={useColorModeValue("gray.200", "gray.700")}
      p={1}
      display={{ base: "flex", md: "none" }} // Show only on mobile
      justifyContent="space-around"
      alignItems="center"
      zIndex="sticky" // Ensure it's above content
    >
      <Tooltip
        label="Home"
        aria-label="Home tooltip"
        placement="top"
        bg={useColorModeValue("purple.100", "purple.700")}
        color={useColorModeValue("purple.600", "purple.200")}
        py={1}
        px={2}
        borderRadius="md"
      >
        <IconButton
          aria-label="Home"
          icon={<Icon as={FiHome} boxSize={6} />}
          size="lg"
          variant="ghost"
          onClick={handleHomeClick}
          colorScheme="purple"
        />
      </Tooltip>
      <Tooltip
        label="Upload"
        aria-label="Upload tooltip"
        placement="top"
        bg={useColorModeValue("purple.100", "purple.700")}
        color={useColorModeValue("purple.600", "purple.200")}
        py={1}
        px={2}
        borderRadius="md"
      >
        <IconButton
          aria-label="Upload"
          icon={<Icon as={FiUpload} boxSize={6} />}
          size="lg"
          variant="ghost"
          onClick={onUploadClick} // Use passed handler
          colorScheme="purple"
        />
      </Tooltip>
      <Tooltip
        label="Generate"
        aria-label="Generate tooltip"
        placement="top"
        bg={useColorModeValue("purple.100", "purple.700")}
        color={useColorModeValue("purple.600", "purple.200")}
        py={1}
        px={2}
        borderRadius="md"
      >
        <IconButton
          aria-label="Generate"
          icon={<Icon as={FiCpu} boxSize={6} />}
          size="lg"
          variant="ghost"
          onClick={onGenerateClick} // Use passed handler
          colorScheme="purple"
        />
      </Tooltip>
    </Box>
  );
};
// --- BottomNavigation Component Definition Ends ---

const Header = () => {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const { searchQuery, setSearchQuery, uiSearchQuery, setUiSearchQuery } =
    useSearchQuery();
  const prevSearchQueryRef = useRef(searchQuery);
  const { isOpen, onOpen, onClose } = useDisclosure(); // Note: This disclosure might conflict if UserMenu uses it internally without its own instance. UserMenu seems to handle its own state correctly.
  const { user, setUser } = useUser();
  const [isFilterOpen, setIsFilterOpen] = useState(false); // Keep this for modal logic if needed later
  const searchBarRef = useRef(null);
  const [modalStyle, setModalStyle] = useState({}); // Keep this for modal logic
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false }); // Check if mobile

  // Fetch categories logic remains the same
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
      // Basic error check
      if (!response.ok) {
        console.error("Failed to fetch categories");
        return [];
      }
      return response.json();
    },
    enabled: isFilterOpen, // Only fetch when the filter modal is intended to be open
  });

  // Modal positioning logic remains the same
  const updateModalStyle = () => {
    if (searchBarRef.current) {
      const rect = searchBarRef.current.getBoundingClientRect();
      const inputElement = searchBarRef.current.querySelector("input"); // More specific target
      if (inputElement) {
        const inputRect = inputElement.getBoundingClientRect();
        setModalStyle({
          width: `${inputRect.width}px`,
          left: `${inputRect.left}px`,
          top: `${inputRect.bottom + 5}px`, // Position below the input
        });
      }
    }
  };

  useEffect(() => {
    updateModalStyle(); // Initial call
    window.addEventListener("resize", updateModalStyle);
    return () => window.removeEventListener("resize", updateModalStyle);
  }, []); // Run only once on mount

  useEffect(() => {
    if (isFilterOpen) {
      updateModalStyle(); // Update position if filter opens
    }
  }, [isFilterOpen]);

  // Navigation effect remains the same
  useEffect(() => {
    if (
      prevSearchQueryRef.current !== searchQuery &&
      searchQuery !== undefined // Add check for undefined
    ) {
      // Only navigate if search query actually changed and isn't undefined
      if (window.location.pathname !== "/") {
        // Prevent navigation if already on '/'
        navigate("/", { replace: true });
      }
    }
    prevSearchQueryRef.current = searchQuery;
  }, [searchQuery, navigate]);

  const handleSignInClick = () => setIsSignInModalOpen(true);
  const handleSignInModalClose = () => setIsSignInModalOpen(false);

  const handleUploadClick = () => {
    // Trigger the hidden file input
    document.getElementById("file-upload")?.click();
  };

  const handleGenerateClick = () => {
    // Navigate to the generate page
    navigate("/generate");
  };

  // Define gradient colors for easy reuse
  const gradientStart = "#3ac7cf";
  const gradientMid = "#6b7fe8";
  const gradientEnd = "#8f5bf5";

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
      borderBottomColor={useColorModeValue("gray.200", "gray.700")} // Adjusted dark mode border
      zIndex="sticky"
    >
      <Flex
        align="center"
        justify="space-between"
        wrap="nowrap" // Prevent wrapping on small screens if possible, adjust gap instead
        mx="auto"
        px={{ base: 2, md: 4 }}
        gap={{ base: 2, md: 4, lg: 10 }} // Responsive gap
      >
        {/* Logo */}
        <RouterLink
          onClick={() => {
            setSearchQuery("");
            setUiSearchQuery("");
            window.scrollTo(0, 0);
            sessionStorage.setItem("scrollPosition-main-", "0");
            // No need to navigate here if already handled by useEffect
          }}
          to="/"
          style={{ textDecoration: "none", flexShrink: 0 }} // Prevent logo from shrinking
        >
          <Box display={{ base: "none", md: "flex" }} alignItems="center">
            {" "}
            {/* Added alignItems */}
            <div
              className="ai-artbase-logo"
              style={{
                color: "transparent",
                backgroundImage: `linear-gradient(to bottom, ${gradientStart}, ${gradientMid}, ${gradientEnd})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                fontWeight: "bold",
                // Increased Font Size for Desktop
                fontSize: "2rem", // Example: Increased from 1.5rem
                lineHeight: "1", // Adjust line height if needed
              }}
            >
              Ai ArtBase
            </div>
          </Box>
          <Box display={{ base: "flex", md: "none" }}>
            <div
              className="ai-artbase-logo"
              style={{
                color: "transparent",
                backgroundImage: `linear-gradient(to bottom, ${gradientStart}, ${gradientMid}, ${gradientEnd})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                fontWeight: "bold",
                fontSize: "1.8rem", // Make single letter larger
              }}
            >
              A
            </div>
          </Box>
        </RouterLink>

        {/* Search Input Group */}
        <InputGroup
          size="lg"
          flex="1" // Allow input to grow
          minW={{ base: "150px", sm: "200px" }} // Minimum width for input
          maxW="600px" // Maximum width
          position="relative"
          ref={searchBarRef}
        >
          <InputLeftElement pointerEvents="none" zIndex="1">
            {/* Use a slightly more prominent icon color */}
            <Icon as={SearchIcon} color="gray.500" />
          </InputLeftElement>
          <Input
            variant="filled"
            bg={useColorModeValue("gray.100", "gray.700")} // Slightly darker fill
            _hover={{ bg: useColorModeValue("gray.200", "gray.600") }} // Subtle hover
            // Focus style using gradient color
            _focus={{
              borderColor: gradientMid, // Use mid gradient color for border
              boxShadow: `0 0 0 1px ${gradientMid}`, // Add a ring effect matching the border
              bg: useColorModeValue("gray.100", "gray.700"), // Keep background consistent on focus
            }}
            placeholder="Search for AI images"
            borderRadius="full"
            fontWeight="500"
            color={useColorModeValue("gray.700", "gray.200")}
            value={uiSearchQuery ?? ""} // Ensure value is never undefined/null for controlled input
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Handle search submission on Enter key press
                e.preventDefault();
                // The search query is already being set via onChange
                // Any additional search submission logic would go here
                setSearchQuery(e.target.value);
                setUiSearchQuery(e.target.value);
                window.history.pushState({ state: e.target.value }, "", "/");
                // Unfocus (blur) the input field when Enter is pressed
                e.currentTarget.blur();
              }
            }}
            onChange={(e) => setUiSearchQuery(e.target.value)}
            pl={10} // Ensure text doesn't overlap icon
            pr={4} // Standard padding right
          />
          {/* Filter Icon - uncomment if needed again
            <Box
             position="absolute"
             pt={2} // Adjust vertical alignment if needed
             right="4"
             top="50%"
             transform="translateY(-50%)" // Center vertically
             cursor="pointer"
             onClick={() => setIsFilterOpen(!isFilterOpen)}
             zIndex="1" // Ensure it's above the input field visually
            >
             <Icon as={BiFilterAlt} color="gray.500" boxSize={5} _hover={{ color: gradientMid }} />
            </Box>
           */}
        </InputGroup>

        {/* Categories Modal - If using Filter Icon */}
        {/* Ensure ModalContent positioning uses the state */}
        {/*
           <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} >
              <ModalOverlay bg="blackAlpha.100" /> // Very subtle overlay
              <ModalContent
                position="absolute" // Crucial for positioning
                style={modalStyle} // Apply calculated styles
                mt={1} // Small margin top from input
                boxShadow="lg"
                borderRadius="md"
                bg={useColorModeValue("white", "gray.700")}
                maxW="none" // Override default maxW
                w={modalStyle.width} // Set width from state
              >
                <ModalBody p={3}>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color={useColorModeValue("gray.600", "gray.300")}>Top Categories:</Text>
                  <Flex flexWrap="wrap" gap={2} justifyContent="center">
                    {categories?.length > 0 ? categories.map((category) => (
                      <Button
                        key={category.name}
                        size="sm"
                        variant="outline"
                        borderRadius="full"
                        colorScheme="purple" // Use a color scheme related to your theme
                        onClick={() => {
                          setSearchQuery(category.name);
                          // Navigation might be handled by useEffect already, check logic
                          // navigate( `/?search=${encodeURIComponent(category.name)}`, { replace: false, state: { searchQuery: category.name } } );
                          setIsFilterOpen(false);
                        }}
                      >
                        {category.name}
                      </Button>
                    )) : <Text fontSize="sm" color="gray.500">No categories found.</Text>}
                  </Flex>
                </ModalBody>
              </ModalContent>
            </Modal>
          */}

        {/* Action Buttons Area */}
        <Flex align="center" gap={{ base: 1, md: 2 }} flexShrink={0}>
          {" "}
          {/* Prevent shrinking */}
          {/* Desktop Upload/Generate Buttons - Always shown */}
          <Box display={{ base: "none", md: "flex" }} gap={2}>
            <Tooltip
              label="Generate"
              aria-label="Generate tooltip"
              placement="top"
              bg={useColorModeValue("purple.100", "purple.700")}
              color={useColorModeValue("purple.600", "purple.200")}
              py={1}
              px={2}
              borderRadius="full"
            >
              <IconButton
                aria-label="Generate"
                icon={<Icon as={FiCpu} boxSize={6} />}
                size="lg"
                variant="ghost"
                onClick={handleGenerateClick}
                colorScheme="purple"
              />
            </Tooltip>
            <Tooltip
              label="Upload"
              aria-label="Upload tooltip"
              placement="top"
              bg={useColorModeValue("purple.100", "purple.700")}
              color={useColorModeValue("purple.600", "purple.200")}
              py={1}
              px={2}
              borderRadius="full"
            >
              <IconButton
                aria-label="Upload"
                icon={<Icon as={FiUpload} boxSize={6} />}
                size="lg"
                variant="ghost"
                onClick={handleUploadClick}
                colorScheme="purple"
              />
            </Tooltip>
          </Box>
          {/* Conditional Rendering based on token/user */}
          {localStorage.getItem("token") && user ? (
            <>
              {/* User Menu */}
              <UserMenu
                user={user}
                setUser={setUser}
                onSignOut={() => {
                  /* handle sign out related state if needed */
                }}
              />
            </>
          ) : (
            <>
              {/* Sign In Button */}
              <Box display={{ base: "none", md: "flex" }}>
                <PurpleButton name="Sign In" onClick={handleSignInClick} />
              </Box>
              <Box display={{ base: "flex", md: "none" }}>
                <PurpleButton
                  name={<FaSignInAlt size="1.1em" />} // Use icon with adjusted size
                  onClick={handleSignInClick}
                  px={3} // Adjust padding for icon button
                  py={3} // Make it squarer
                />
              </Box>
            </>
          )}
        </Flex>
      </Flex>

      {/* Sign In Modal */}
      <SignInModal
        setUser={setUser}
        isOpen={isSignInModalOpen}
        onClose={handleSignInModalClose}
      />

      {/* Render Bottom Navigation only on mobile */}
      {isMobile && (
        <BottomNavigation
          onUploadClick={handleUploadClick}
          onGenerateClick={handleGenerateClick}
        />
      )}
    </Box>
  );
};

export default Header;
