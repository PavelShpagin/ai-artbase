import {
  Box,
  VStack,
  IconButton,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaHome, FaPlus, FaMagic, FaHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const navItems = [
  { label: "Home", icon: FaHome, route: "/" },
  { label: "Upload", icon: FaPlus, route: "/upload" },
  { label: "Generate", icon: FaMagic, route: "/generate" },
  { label: "Liked", icon: FaHeart, route: "/liked" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const hoverBg = useColorModeValue("purple.50", "gray.700");
  const sidebarBg = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      as="nav"
      position="fixed"
      left={0}
      top={0}
      h="100vh"
      w="64px"
      bg={sidebarBg}
      borderRight="1px"
      borderColor={borderCol}
      display="flex"
      flexDirection="column"
      justifyContent="flex-start"
      zIndex={100}
      boxShadow="sm"
    >
      {/* Top: Logo */}
      <VStack mt={4} spacing={8}>
        <Tooltip label="AI ArtBase" placement="right">
          <Box
            fontWeight="bold"
            fontSize="2xl"
            color="transparent"
            bgGradient="linear(to-b, #3ac7cf, #6b7fe8, #8f5bf5)"
            bgClip="text"
            cursor="pointer"
            onClick={() => navigate("/")}
          >
            A
          </Box>
        </Tooltip>
        {/* Navigation Icons */}
        <VStack spacing={4}>
          {navItems.map((item) => (
            <Tooltip key={item.label} label={item.label} placement="right">
              <IconButton
                aria-label={item.label}
                icon={<item.icon size="1.5em" />}
                variant="ghost"
                colorScheme="purple"
                fontSize="xl"
                onClick={() => navigate(item.route)}
                _hover={{ bg: hoverBg }}
                isRound
              />
            </Tooltip>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
};

export default Sidebar;
