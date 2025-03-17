import React from "react";
import { Button, Box } from "@chakra-ui/react";

const PurpleButton = ({ name, onClick, w, loading, px = 8, py = 4 }) => {
  return (
    <Button
      isDisabled={loading}
      w={w}
      size="lg"
      bgGradient="linear(to-r, purple.600, purple.400)"
      color="white"
      borderRadius="full"
      px={px}
      py={py}
      fontSize="md"
      fontWeight="bold"
      shadow="md"
      _hover={{
        bgGradient: "linear(to-r, purple.700, purple.500)",
        shadow: "lg",
      }}
      _focus={{
        outline: "none",
        shadow: "outline",
      }}
      _active={{
        bgGradient: "linear(to-r, purple.800, purple.600)",
      }}
      transition="all 0.2s ease-in-out"
      onClick={onClick}
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        //top="0"
        //right="0"
        //bottom="0"
        //left="0"
        //display="flex"
        //justifyContent="center"
        //alignItems="center"
      >
        {/* {loading && <Spinner size="sm" color="white" />} */}
      </Box>
      <Box
        visibility={loading ? "hidden" : "visible"}
        //fontSize="inherit"
        //fontWeight="inherit"
      >
        {name}
      </Box>
    </Button>
  );
};

export default PurpleButton;
