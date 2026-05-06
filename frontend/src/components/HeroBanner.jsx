import React from "react";
import { Box, Heading, Text, HStack, VStack, Tag, Icon, useColorModeValue } from "@chakra-ui/react";
import { FiStar, FiZap } from "react-icons/fi";

export default function HeroBanner() {
  const bg = useColorModeValue(
    "linear-gradient(135deg, #f5edff 0%, #e6f0ff 100%)",
    "linear-gradient(135deg, #1a1530 0%, #14223d 100%)"
  );
  const heading = useColorModeValue("gray.900", "white");
  const sub = useColorModeValue("gray.600", "gray.300");
  return (
    <Box
      bgGradient={bg}
      borderRadius={{ base: 0, md: "xl" }}
      mx={{ base: 0, md: 4 }}
      mt={{ base: 0, md: 2 }}
      mb={4}
      px={{ base: 5, md: 8 }}
      py={{ base: 6, md: 10 }}
    >
      <VStack align="center" textAlign="center" spacing={3} maxW="780px" mx="auto">
        <HStack spacing={2}>
          <Tag colorScheme="purple" borderRadius="full" px={3}>
            <Icon as={FiStar} mr={1} />
            Hand-picked
          </Tag>
          <Tag colorScheme="blue" borderRadius="full" px={3}>
            <Icon as={FiZap} mr={1} />
            Free generation
          </Tag>
        </HStack>
        <Heading size={{ base: "lg", md: "xl" }} color={heading} lineHeight="1.1">
          AI art that doesn't look like AI.
        </Heading>
        <Text color={sub} fontSize={{ base: "sm", md: "md" }}>
          The best of AI art, scored and ranked so you skip the slop. Free generation, no sign-up needed.
        </Text>
      </VStack>
    </Box>
  );
}
