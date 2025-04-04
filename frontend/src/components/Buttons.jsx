// src/components/Buttons.js
import React from "react";
import { Button, useColorModeValue } from "@chakra-ui/react";

const PurpleButton = ({ name, onClick, w, loading, px = 8, py = 4 }) => {
  // Use a solid purple that aligns with the theme (e.g., purple.500)
  // Use useColorModeValue if you want different purples for light/dark modes
  const bgColor = useColorModeValue("purple.500", "purple.400");
  const hoverBgColor = useColorModeValue("purple.600", "purple.500");
  const activeBgColor = useColorModeValue("purple.700", "purple.600");

  return (
    <Button
      isDisabled={loading}
      isLoading={loading}
      w={w}
      size="lg"
      color="white" // Keep text white for contrast
      borderRadius="full" // Keep the rounded style from previous iterations
      fontSize="md"
      fontWeight="600" // Keep font weight slightly bold
      bg={bgColor} // Apply the solid background color
      boxShadow="md" // Maintain a subtle shadow
      transition="all 0.2s ease-in-out" // Keep transition for smooth bg and shadow changes
      _hover={{
        bg: hoverBgColor, // Darken slightly on hover
        boxShadow: "lg", // Keep shadow change for visual feedback
        _disabled: {
          // Ensure disabled styles override hover
          bg: bgColor, // Keep original bg when disabled
          boxShadow: "md",
        },
      }}
      _active={{
        bg: activeBgColor, // Darken more on active
        boxShadow: "md", // Reset shadow on active press
      }}
      onClick={onClick}
      px={px}
      py={py}
      position="relative"
      // Style potential icons within the button
      sx={{
        ".chakra-button__icon, svg": {
          // Target both icon prop and direct SVG usage
          color: "white",
          fontSize: "1.1em", // Slightly enlarge icons if needed
        },
        // Style the loading spinner
        ".chakra-spinner": {
          color: "white", // Make spinner white
          borderLeftColor: "rgba(255,255,255,0.3)", // Make spinner trail slightly transparent
          borderBottomColor: "rgba(255,255,255,0.3)",
          borderRightColor: "rgba(255,255,255,0.3)",
        },
      }}
    >
      {name}
    </Button>
  );
};

export default PurpleButton;
