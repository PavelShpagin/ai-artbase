import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  Heading,
  Textarea,
  Tag,
  Spinner,
  useToast,
  VStack,
  Text,
  Wrap,
  WrapItem,
  Icon,
  Badge,
  HStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiCpu, FiImage, FiZap, FiStar } from "react-icons/fi";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useUser } from "../contexts/UserContext";
import PurpleButton from "../components/Buttons";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.aiartbase.com";

// Default lineup if /generate/models hasn't loaded yet.
const DEFAULT_MODELS = [
  { id: "flux-schnell", label: "Flux Schnell", tier: "free", note: "fast" },
  { id: "sdxl", label: "Stable Diffusion XL", tier: "free", note: "" },
  { id: "nano-banana", label: "Nano-Banana", tier: "pro", note: "Gemini 2.5" },
];

const GeneratePage = () => {
  const { user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState("flux-schnell");
  const [isLoading, setIsLoading] = useState(false);
  const [visibleArts, setVisibleArts] = useState([]);
  const [arts, setArts] = useState([]);
  const [isPro, setIsPro] = useState(false);
  const toast = useToast({ position: "top", duration: 5000, isClosable: true });

  const inputBg = useColorModeValue("gray.100", "gray.700");
  const inputHoverBg = useColorModeValue("gray.200", "gray.600");
  const focusBorderColor = useColorModeValue("purple.500", "purple.300");
  const selectedTagBg = useColorModeValue("purple.100", "purple.700");
  const selectedTagColor = useColorModeValue("purple.600", "purple.300");

  // Load model registry from backend (graceful fallback)
  useEffect(() => {
    fetch(`${API_BASE}/generate/models`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length) setModels(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setIsPro(false); return; }
    fetch(`${API_BASE}/credits/balance/${user.id}`)
      .then((r) => r.json()).then((d) => setIsPro(!!d.is_pro)).catch(() => {});
  }, [user?.id]);

  const handleModelSelect = (model) => {
    if (model.tier === "pro" && !isPro) {
      toast({ title: "Pro model", description: "Upgrade to unlock Nano-Banana and Pro models.", status: "info" });
      return;
    }
    setSelectedModel(model.id);
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast({ title: "Prompt is empty", status: "warning" });
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        prompt,
        model: selectedModel,
        number_of_images: "1",
      });
      if (user?.id) params.set("user_id", String(user.id));
      const response = await fetchAPI(
        `/generate/image/?${params.toString()}`,
        "POST",
        null,
        { "Content-Type": "application/json", accept: "application/json" },
        false,
        true
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402) {
          toast({
            title: "Limit reached",
            description: err?.detail?.message || "Free limit reached. Sign in or buy a credit pack.",
            status: "warning",
          });
        } else {
          toast({ title: "Generation failed", description: err?.detail || "Try again", status: "error" });
        }
        return;
      }
      const newArts = await response.json();
      if (Array.isArray(newArts) && newArts.length) {
        setVisibleArts((prev) => [...newArts, ...prev]);
        setArts((prev) => [...newArts, ...prev]);
        if (user?.id) {
          const storageKey = `arts-generate-${user.id}`;
          const existing = JSON.parse(localStorage.getItem(storageKey)) || [];
          localStorage.setItem(storageKey, JSON.stringify([...newArts, ...existing]));
        }
        const score = newArts[0]?.quality_score;
        toast({
          title: "Image generated",
          description: typeof score === "number" ? `Quality score: ${Math.round(score)}/100` : undefined,
          status: "success",
        });
      } else {
        toast({ title: "No image returned", status: "warning" });
      }
    } catch (e) {
      toast({ title: "Generation failed", description: e.message || "", status: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedModel, user, toast]);

  // Fetch user's prior generations only when signed in
  const fetchArts = useCallback(async () => {
    if (!user?.id) return;
    const storageKey = `arts-generate-${user.id}`;
    if (localStorage.getItem(storageKey)) return;
    try {
      const data = await fetchAPI(`/arts/generated/${user.id}?viewer_id=${user.id}`);
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (_) {}
  }, [user]);

  const emptyState = (
    <Flex justify="center" align="center" height="50vh" direction="column" color="gray.400">
      <Icon as={FiImage} boxSize={12} mb={4} />
      <Text textAlign="center">Your generated images will appear here.</Text>
      {!user && (
        <Text fontSize="sm" mt={2} maxW="320px" textAlign="center">
          No sign-in needed to try free models. Sign in to keep history and unlock Pro models.
        </Text>
      )}
    </Flex>
  );

  return (
    <Flex direction={{ base: "column", lg: "row" }} pt="15px" px={{ base: 4, md: 8 }} gap={6}>
      <Box flex={{ base: "1", lg: "0 0 400px" }} mb={{ base: 6, lg: 0 }}>
        <VStack spacing={6} align="stretch">
          <Flex align="center" mb={0}>
            <Icon as={FiCpu} color="purple.500" fontSize="24px" mr={2} />
            <Heading size="lg" color="gray.700" fontWeight="600">Generate</Heading>
          </Flex>
          <Box>
            <Text mb="8px" fontWeight="medium">Prompt</Text>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A cinematic portrait of a snow leopard at golden hour..."
              size="lg"
              minHeight="140px"
              bg={inputBg}
              _hover={{ bg: inputHoverBg }}
              _focus={{ borderColor: focusBorderColor, boxShadow: `0 0 0 1px ${focusBorderColor}`, bg: inputBg }}
              borderRadius="xl"
            />
          </Box>
          <Box>
            <HStack mb="8px" spacing={2}>
              <Text fontWeight="medium">Model</Text>
              <Text fontSize="xs" color="gray.500">(quality scored automatically)</Text>
            </HStack>
            <Wrap spacing={2}>
              {models.map((m) => {
                const isSelected = selectedModel === m.id;
                const locked = m.tier === "pro" && !isPro;
                return (
                  <WrapItem key={m.id}>
                    <Tag
                      size="lg"
                      variant={isSelected ? "solid" : "outline"}
                      bg={isSelected ? selectedTagBg : undefined}
                      color={isSelected ? selectedTagColor : undefined}
                      onClick={() => handleModelSelect(m)}
                      cursor={locked ? "not-allowed" : "pointer"}
                      opacity={locked ? 0.5 : 1}
                      borderRadius="full"
                      px={4}
                      py={1.5}
                      borderColor={isSelected ? selectedTagColor : useColorModeValue("gray.200", "gray.600")}
                    >
                      <HStack spacing={1.5}>
                        <Icon as={m.tier === "pro" ? FiStar : FiZap} boxSize={3.5} />
                        <Text>{m.label}</Text>
                        {m.tier === "pro" && (
                          <Badge colorScheme="purple" fontSize="0.65em">PRO</Badge>
                        )}
                      </HStack>
                    </Tag>
                  </WrapItem>
                );
              })}
            </Wrap>
          </Box>
          <PurpleButton
            name={isLoading ? "Generating..." : "Generate"}
            onClick={handleGenerate}
            loading={isLoading}
            size="lg"
            w="full"
          />
          {!user && (
            <Text fontSize="xs" color="gray.500" textAlign="center">
              Free anonymous tier: 2 images/day. Sign in for 5/day.
            </Text>
          )}
        </VStack>
      </Box>
      <Box flex="1" minHeight="80vh" borderLeft={{ lg: "1px solid" }} borderColor={{ lg: "gray.200" }} pl={{ lg: 6 }}>
        <Heading size="md" mb={4} color="gray.600">Recent Generations</Heading>
        <ArtGallery
          fetchArts={fetchArts}
          visibleArts={visibleArts}
          setVisibleArts={setVisibleArts}
          arts={arts}
          setArts={setArts}
          emptyStateComponent={emptyState}
        />
      </Box>
    </Flex>
  );
};

export default GeneratePage;
