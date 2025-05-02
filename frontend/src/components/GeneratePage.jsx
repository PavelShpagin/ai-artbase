import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  Heading,
  Textarea,
  Button,
  Tag,
  Spinner,
  useToast,
  VStack,
  Text,
  Wrap,
  WrapItem,
  Icon,
} from "@chakra-ui/react";
import { FiCpu } from "react-icons/fi";
import { ArtGallery } from "./ArtGallery"; // Assuming ArtGallery can take an 'arts' prop
// import fetchAPI from "../services/api"; // Keep commented until API call is implemented
import { useUser } from "../contexts/UserContext";
import { useAuthRedirect } from "../hooks/useAuthRedirect"; // Assuming you have this hook

const availableModels = ["Imagen3"]; // Add more models here in the future

const GeneratePage = () => {
  useAuthRedirect(); // Redirect if not logged in
  const { user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState(availableModels); // Select all by default
  const [generatedArts, setGeneratedArts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const storageKey = "generated-arts";

  // Load generated arts from session storage on mount
  useEffect(() => {
    const storedArts = sessionStorage.getItem(storageKey);
    if (storedArts) {
      try {
        setGeneratedArts(JSON.parse(storedArts));
      } catch (error) {
        console.error("Failed to parse stored generated arts:", error);
        sessionStorage.removeItem(storageKey); // Clear invalid data
      }
    }
  }, []);

  // Save generated arts to session storage when they change
  useEffect(() => {
    if (generatedArts.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(generatedArts));
    }
    // If generatedArts becomes empty (e.g., after clearing), remove from storage
    // else {
    //   sessionStorage.removeItem(storageKey);
    // }
  }, [generatedArts]);

  const handleModelToggle = (model) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt is empty",
        description: "Please enter a prompt to generate images.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (selectedModels.length === 0) {
      toast({
        title: "No models selected",
        description: "Please select at least one model.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      // *** TODO: Replace with actual API call ***
      // This is a placeholder structure. You'll need to implement the
      // backend endpoint '/arts/generate/' in your FastAPI app (arts.py).
      // It should accept { prompt: string, models: string[], user_id: number }
      // and return { arts: ArtObject[] }
      console.log("Generating with:", {
        prompt,
        models: selectedModels,
        user_id: user?.id,
      });
      // Example API call structure:
      /*
      const response = await fetchAPI('/arts/generate/', 'POST', {
         prompt: prompt,
         models: selectedModels,
         user_id: user?.id // Optional: associate generation with user
      });
      const data = await response.json(); // Assuming API returns { arts: [...] }

      if (!response.ok) {
          throw new Error(data.detail || 'Failed to generate images');
      }

      const newArts = data.arts || [];
      */

      // Placeholder response simulation:
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network delay
      const newArts = selectedModels.map((model, index) => ({
        id: `gen-${Date.now()}-${index}`,
        image_url: `https://via.placeholder.com/512?text=${encodeURIComponent(
          prompt.substring(0, 20)
        )}+(${model})`,
        prompt: prompt,
        model_name: model,
        user_id: user?.id,
        // Add other necessary Art fields if ArtGallery expects them
        // e.g., created_at, likes_count, is_liked_by_user etc.
        // These might need default values or need to come from the real API
        created_at: new Date().toISOString(),
        likes_count: 0,
        is_liked_by_user: false,
        user: {
          // Basic user info if needed by ArtCard
          id: user?.id,
          username: user?.username || "Generator",
          picture: user?.picture,
        },
      }));
      // ------------------------------

      // Prepend new arts to the existing list
      setGeneratedArts((prev) => [...newArts, ...prev]);

      toast({
        title: "Images generated!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Generation failed:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate images.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedModels, user, toast]);

  // TODO: Add download/upload functionality later

  return (
    <Flex
      direction={{ base: "column", lg: "row" }}
      pt="15px"
      px={{ base: 4, md: 8 }}
      gap={6}
    >
      {/* Left Column: Controls */}
      <Box flex={{ base: "1", lg: "0 0 400px" }} mb={{ base: 6, lg: 0 }}>
        <VStack spacing={6} align="stretch">
          <Flex align="center" mb={0}>
            <Icon as={FiCpu} color="purple.500" fontSize="24px" mr={2} />
            <Heading size="lg" color="gray.700" fontWeight="600">
              Generate AI Images
            </Heading>
          </Flex>

          {/* Prompt Input */}
          <Box>
            <Text mb="8px" fontWeight="medium">
              Prompt:
            </Text>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your creative prompt here..."
              size="lg"
              minHeight="150px" // Make textarea taller
              bg="white" // Ensure background contrast
              _focus={{
                borderColor: "purple.500",
                boxShadow: `0 0 0 1px var(--chakra-colors-purple-500)`,
              }}
            />
          </Box>

          {/* Model Selection */}
          <Box>
            <Text mb="8px" fontWeight="medium">
              Models:
            </Text>
            <Wrap spacing={2}>
              {availableModels.map((model) => (
                <WrapItem key={model}>
                  <Tag
                    size="lg"
                    variant={
                      selectedModels.includes(model) ? "solid" : "outline"
                    }
                    colorScheme={
                      selectedModels.includes(model) ? "purple" : "gray"
                    }
                    onClick={() => handleModelToggle(model)}
                    cursor="pointer"
                    borderRadius="full" // Use full border radius
                    px={4} // Add more horizontal padding
                    py={1.5} // Add vertical padding
                  >
                    {model}
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          </Box>

          {/* Generate Button */}
          <Button
            colorScheme="purple"
            size="lg"
            onClick={handleGenerate}
            isLoading={isLoading}
            loadingText="Generating..."
            leftIcon={isLoading ? <Spinner size="sm" /> : undefined}
            w="full" // Make button full width of its container
          >
            Generate Images
          </Button>
        </VStack>
      </Box>

      {/* Right Column: Gallery */}
      <Box
        flex="1"
        minHeight="80vh"
        borderLeft={{ lg: "1px solid" }}
        borderColor={{ lg: "gray.200" }}
        pl={{ lg: 6 }}
      >
        <Heading size="md" mb={4} color="gray.600">
          Generated Gallery
        </Heading>
        {generatedArts.length === 0 && !isLoading ? (
          <Flex
            justify="center"
            align="center"
            height="50vh"
            direction="column"
            color="gray.400"
          >
            <Icon as={FiCpu} boxSize={12} mb={4} />
            <Text>Your generated images will appear here.</Text>
          </Flex>
        ) : (
          // Pass generatedArts directly to ArtGallery
          // Assuming ArtGallery accepts an 'arts' prop
          <ArtGallery arts={generatedArts} isLoading={isLoading} />
        )}
        {/* TODO: Add download/upload controls here or within ArtGallery/ArtCard */}
      </Box>
    </Flex>
  );
};

export default GeneratePage;
