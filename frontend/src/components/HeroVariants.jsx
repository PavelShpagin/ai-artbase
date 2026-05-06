/**
 * 5 hero banner variants for A/B comparison on localhost / live.
 * Mounted at /v1 .. /v5 — pick the winner, replace HeroBanner default.
 */
import React, { useEffect, useState } from "react";
import {
  Box, Heading, Text, HStack, VStack, Tag, Icon, Image, SimpleGrid,
  Stack, Button, Flex, useColorModeValue, Spacer, Badge,
} from "@chakra-ui/react";
import { FiStar, FiZap, FiAward, FiTrendingUp, FiCheck, FiX, FiSearch, FiArrowRight } from "react-icons/fi";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.aiartbase.com";

// Helper: fetch a few premium images for variants that show samples
function usePremiumSamples(n = 6) {
  const [imgs, setImgs] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/arts/?tier=curated&limit=${n}`)
      .then((r) => r.json())
      .then((d) => setImgs((d || []).slice(0, n)))
      .catch(() => {});
  }, [n]);
  return imgs;
}

// ------------------- V1: current minimal (tight, two tags) -------------------
export function HeroV1() {
  const bg = useColorModeValue(
    "linear-gradient(135deg, #f5edff 0%, #e6f0ff 100%)",
    "linear-gradient(135deg, #1a1530 0%, #14223d 100%)"
  );
  const heading = useColorModeValue("gray.900", "white");
  const sub = useColorModeValue("gray.600", "gray.300");
  return (
    <Box bgGradient={bg} borderRadius={{ base: 0, md: "xl" }} mx={{ base: 0, md: 4 }} mt={{ base: 0, md: 2 }} mb={4} px={{ base: 5, md: 8 }} py={{ base: 5, md: 6 }}>
      <VStack align="flex-start" spacing={2} maxW="1100px" mx="auto">
        <HStack spacing={2}>
          <Tag colorScheme="purple" borderRadius="full" px={3}><Icon as={FiStar} mr={1} />Hand-picked</Tag>
          <Tag colorScheme="blue" borderRadius="full" px={3}><Icon as={FiZap} mr={1} />Free flux generation</Tag>
        </HStack>
        <Heading size={{ base: "md", md: "lg" }} color={heading} lineHeight="1.15">AI art that doesn't look like AI.</Heading>
        <Text color={sub} fontSize={{ base: "sm", md: "md" }} maxW="780px">
          Every image scored by Gemini Vision against composition, craftsmanship, and an "AI obviousness" rubric. We curate from across the AI art ecosystem.
        </Text>
      </VStack>
    </Box>
  );
}

// ------------------- V2: hero + featured strip on the right -------------------
export function HeroV2() {
  const samples = usePremiumSamples(4);
  const bg = useColorModeValue(
    "linear-gradient(135deg, #faf5ff 0%, #eef2ff 50%, #ecfdf5 100%)",
    "linear-gradient(135deg, #1a1530 0%, #14223d 50%, #0f2e2a 100%)"
  );
  const heading = useColorModeValue("gray.900", "white");
  const sub = useColorModeValue("gray.600", "gray.300");
  return (
    <Box bgGradient={bg} borderRadius={{ base: 0, md: "xl" }} mx={{ base: 0, md: 4 }} mt={{ base: 0, md: 2 }} mb={4} px={{ base: 5, md: 8 }} py={{ base: 6, md: 8 }} overflow="hidden">
      <Flex maxW="1200px" mx="auto" align="center" gap={6} direction={{ base: "column", md: "row" }}>
        <VStack align="flex-start" spacing={3} flex="1" minW={0}>
          <HStack spacing={2}>
            <Tag colorScheme="purple" borderRadius="full" px={3}><Icon as={FiStar} mr={1} />Hand-picked</Tag>
            <Tag colorScheme="green" borderRadius="full" px={3}>30k+ scanned</Tag>
          </HStack>
          <Heading size={{ base: "lg", md: "xl" }} color={heading} lineHeight="1.1">
            AI art that doesn't <Box as="span" bgGradient="linear(to-r, purple.500, pink.500)" bgClip="text">look like AI.</Box>
          </Heading>
          <Text color={sub} fontSize={{ base: "md", md: "lg" }} maxW="560px">
            Every image scored by Gemini Vision on composition, craftsmanship, and AI-obviousness. The 5% that pass become Premium.
          </Text>
        </VStack>
        <SimpleGrid columns={2} spacing={2} flex="0 0 auto" w={{ base: "100%", md: "440px" }} h={{ md: "240px" }}>
          {samples.map((art, i) => (
            <Box key={art.id || i} borderRadius="lg" overflow="hidden" position="relative" _hover={{ transform: "scale(1.03)" }} transition="0.2s">
              <Image src={art.src} alt="" w="100%" h={{ base: "120px", md: "118px" }} objectFit="cover" />
            </Box>
          ))}
        </SimpleGrid>
      </Flex>
    </Box>
  );
}

// ------------------- V3: big background image with overlay -------------------
export function HeroV3() {
  const samples = usePremiumSamples(1);
  const heroSrc = samples[0]?.src;
  return (
    <Box position="relative" borderRadius={{ base: 0, md: "xl" }} mx={{ base: 0, md: 4 }} mt={{ base: 0, md: 2 }} mb={4} h={{ base: "320px", md: "360px" }} overflow="hidden" bg="gray.900">
      {heroSrc && (
        <Image src={heroSrc} alt="" position="absolute" top={0} left={0} w="100%" h="100%" objectFit="cover" filter="brightness(0.55)" />
      )}
      <Box position="absolute" inset={0} bgGradient="linear(to-r, blackAlpha.700 0%, blackAlpha.300 60%, transparent 100%)" />
      <Flex position="relative" h="100%" align="center" px={{ base: 6, md: 12 }} maxW="1200px" mx="auto">
        <VStack align="flex-start" spacing={4} maxW="640px">
          <HStack>
            <Tag colorScheme="whiteAlpha" borderRadius="full" bg="whiteAlpha.300" color="white" px={3}><Icon as={FiAward} mr={1} />Curated by AI</Tag>
          </HStack>
          <Heading size={{ base: "xl", md: "2xl" }} color="white" lineHeight="1.05" fontWeight="800">
            AI art that doesn't look like AI.
          </Heading>
          <Text color="whiteAlpha.900" fontSize={{ base: "md", md: "lg" }}>
            Hand-picked from across the AI ecosystem. The 5% that pass our Gemini-Vision rubric.
          </Text>
        </VStack>
      </Flex>
    </Box>
  );
}

// ------------------- V4: stats-driven (big numbers) -------------------
export function HeroV4() {
  const [stats, setStats] = useState({ total: 30000, curated: 9000, premium: 1500 });
  const bg = useColorModeValue("linear-gradient(135deg, #faf5ff 0%, #eef2ff 100%)", "linear-gradient(135deg, #1a1530 0%, #14223d 100%)");
  const heading = useColorModeValue("gray.900", "white");
  const sub = useColorModeValue("gray.600", "gray.300");
  const numColor = useColorModeValue("purple.600", "purple.300");
  return (
    <Box bgGradient={bg} borderRadius={{ base: 0, md: "xl" }} mx={{ base: 0, md: 4 }} mt={{ base: 0, md: 2 }} mb={4} px={{ base: 5, md: 8 }} py={{ base: 6, md: 8 }}>
      <VStack align="flex-start" spacing={4} maxW="1100px" mx="auto">
        <Heading size={{ base: "lg", md: "xl" }} color={heading} lineHeight="1.1">
          AI art that doesn't look like AI.
        </Heading>
        <Text color={sub} fontSize={{ base: "md", md: "lg" }} maxW="720px">
          Every image scanned, scored, and ranked by Gemini Vision on composition, craftsmanship, and AI-obviousness. Only the best survive.
        </Text>
        <HStack spacing={{ base: 6, md: 12 }} pt={2}>
          <VStack align="flex-start" spacing={0}>
            <Heading size={{ base: "xl", md: "2xl" }} color={numColor}>{stats.total.toLocaleString()}+</Heading>
            <Text color={sub} fontSize="sm">scanned across platforms</Text>
          </VStack>
          <VStack align="flex-start" spacing={0}>
            <Heading size={{ base: "xl", md: "2xl" }} color={numColor}>{stats.curated.toLocaleString()}</Heading>
            <Text color={sub} fontSize="sm">curated for you</Text>
          </VStack>
          <VStack align="flex-start" spacing={0}>
            <Heading size={{ base: "xl", md: "2xl" }} color={numColor}>{stats.premium.toLocaleString()}</Heading>
            <Text color={sub} fontSize="sm">premium · top 5%</Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}

// ------------------- V5: side-by-side comparison -------------------
export function HeroV5() {
  const samples = usePremiumSamples(4);
  // First two are "AI ArtBase" (curated), last two pretend to be "typical" — visual hook
  const heading = useColorModeValue("gray.900", "white");
  const sub = useColorModeValue("gray.600", "gray.300");
  const bg = useColorModeValue("white", "gray.800");
  const slopBg = useColorModeValue("gray.50", "gray.900");
  return (
    <Box bg={bg} borderRadius={{ base: 0, md: "xl" }} mx={{ base: 0, md: 4 }} mt={{ base: 0, md: 2 }} mb={4} px={{ base: 5, md: 8 }} py={{ base: 6, md: 8 }} borderWidth="1px" borderColor={useColorModeValue("gray.200", "gray.700")}>
        <VStack align="center" spacing={4} maxW="1200px" mx="auto">
          <Heading size={{ base: "lg", md: "xl" }} color={heading} textAlign="center" lineHeight="1.1">
            AI art that doesn't look like AI.
          </Heading>
          <Text color={sub} fontSize={{ base: "md", md: "lg" }} textAlign="center" maxW="640px">
            Most AI art search returns slop. We use Gemini Vision to curate the 5% that look intentional.
          </Text>
          <SimpleGrid columns={2} spacing={4} w="100%" maxW="900px">
            <Box p={4} borderRadius="lg" bg={slopBg} borderWidth="1px" borderColor={useColorModeValue("gray.200", "gray.700")}>
              <HStack mb={2}><Icon as={FiX} color="red.400" /><Text fontWeight="600" color={heading} fontSize="sm">Typical AI feed</Text></HStack>
              <Text color={sub} fontSize="xs" mb={3}>Six fingers, plastic skin, generic backgrounds.</Text>
              <SimpleGrid columns={2} spacing={2}>
                {samples.slice(2, 4).map((a, i) => (
                  <Box key={i} h="110px" overflow="hidden" borderRadius="md" filter="grayscale(0.7) blur(0.5px)">
                    <Image src={a?.src} w="100%" h="100%" objectFit="cover" />
                  </Box>
                ))}
              </SimpleGrid>
            </Box>
            <Box p={4} borderRadius="lg" bg={useColorModeValue("purple.50", "purple.900")} borderWidth="2px" borderColor="purple.500">
              <HStack mb={2}><Icon as={FiCheck} color="green.500" /><Text fontWeight="600" color={heading} fontSize="sm">AI ArtBase Curated</Text></HStack>
              <Text color={sub} fontSize="xs" mb={3}>Composition. Craftsmanship. Intentional.</Text>
              <SimpleGrid columns={2} spacing={2}>
                {samples.slice(0, 2).map((a, i) => (
                  <Box key={i} h="110px" overflow="hidden" borderRadius="md">
                    <Image src={a?.src} w="100%" h="100%" objectFit="cover" />
                  </Box>
                ))}
              </SimpleGrid>
            </Box>
          </SimpleGrid>
        </VStack>
    </Box>
  );
}
