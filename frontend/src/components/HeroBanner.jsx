import React from "react";
import { Box, Heading, Text, HStack, VStack, Tag, useColorModeValue, Icon } from "@chakra-ui/react";
import { FiStar, FiZap } from "react-icons/fi";

/**
 * Hero banner that owns the UVP. Lives above the main gallery on /.
 * Designed compact — doesn't push the gallery far below the fold.
 */
export default function HeroBanner({ stats }) {
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
      py={{ base: 5, md: 6 }}
      position="relative"
      overflow="hidden"
    >
      <VStack align="flex-start" spacing={2} maxW="1100px" mx="auto">
        <HStack spacing={2}>
          <Tag colorScheme="purple" borderRadius="full" px={3}>
            <Icon as={FiStar} mr={1} />
            Hand-picked
          </Tag>
          <Tag colorScheme="blue" borderRadius="full" px={3}>
            <Icon as={FiZap} mr={1} />
            Free flux generation
          </Tag>
        </HStack>
        <Heading size={{ base: "md", md: "lg" }} color={heading} lineHeight="1.15">
          AI art that doesn't look like AI.
        </Heading>
        <Text color={sub} fontSize={{ base: "sm", md: "md" }} maxW="780px">
          Every image scored by Gemini Vision against composition, craftsmanship, and an "AI obviousness" rubric.
          {stats?.curated ? ` We've curated ${stats.curated.toLocaleString()} from ${stats.total.toLocaleString()}+ scanned across the AI art ecosystem.` : " We curate from across the AI art ecosystem."}
        </Text>
      </VStack>
    </Box>
  );
}
