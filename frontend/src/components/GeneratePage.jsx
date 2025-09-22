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
  useColorModeValue,
} from "@chakra-ui/react";
import { FiCpu, FiImage } from "react-icons/fi";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useUser } from "../contexts/UserContext";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import PurpleButton from "../components/Buttons";
import { useLocation } from "react-router-dom";

const availableModels = ["Imagen3"];

const GeneratePage = () => {
  const { user } = useUser();
  const location = useLocation();
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState(availableModels);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleArts, setVisibleArts] = useState([]);
  const [arts, setArts] = useState([]);
  const toast = useToast({
    position: "top",
    duration: 5000,
    isClosable: true,
  });

  // Color mode values for styling
  const inputBg = useColorModeValue("gray.100", "gray.700");
  const inputHoverBg = useColorModeValue("gray.200", "gray.600");
  const focusBorderColor = useColorModeValue("purple.500", "purple.300");
  const selectedTagBg = useColorModeValue("purple.100", "purple.700");
  const selectedTagColor = useColorModeValue("purple.600", "purple.300");

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
      });
      return;
    }
    if (selectedModels.length === 0) {
      toast({
        title: "No models selected",
        description: "Please select at least one model.",
        status: "warning",
      });
      return;
    }

    setIsLoading(true);

    // Max retry attempts and initial delay
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 2000; // 2 seconds

    const attemptGeneration = async (retryCount) => {
      try {
        ////console.log(`Generation attempt ${retryCount + 1}/${MAX_RETRIES + 1}`);

        // Show retry message if this is a retry attempt
        if (retryCount > 0) {
          toast({
            title: `Retry ${retryCount}/${MAX_RETRIES}`,
            description: "Previous attempt didn't return images. Retrying...",
            status: "info",
            duration: 2000,
            isClosable: true,
          });
        }

        const response = await fetchAPI(
          `/generate/image/?prompt=${prompt}&user_id=${
            user ? user.id : 4
          }&number_of_images=1`,
          "POST",
          null,
          {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          false,
          true
        );

        // Check for HTTP errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Special handling for the "no images" error - retry if we haven't maxed out
          if (
            errorData.detail ===
              "Image generation call succeeded but returned no images." &&
            retryCount < MAX_RETRIES
          ) {
            // Exponential backoff
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            //console.log(`No images returned. Retrying in ${delay}ms...`);

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Recursively retry
            return attemptGeneration(retryCount + 1);
          }

          throw new Error(errorData.detail || "Failed to generate images");
        }
        // Parse the response
        const responseData = await response.json();
        //console.log("Response data:", responseData);

        // Handle direct array of arts
        if (Array.isArray(responseData)) {
          if (responseData.length === 0 && retryCount < MAX_RETRIES) {
            // Empty array but we can retry
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            //console.log(`Empty arts array. Retrying in ${delay}ms...`);

            await new Promise((resolve) => setTimeout(resolve, delay));
            return attemptGeneration(retryCount + 1);
          }

          return responseData;
        }

        // If we got here with data but in an unexpected format
        throw new Error("Unexpected API response format");
      } catch (error) {
        // If this is a retry-eligible error and we haven't maxed out retries
        if (
          error.message ===
            "Image generation call succeeded but returned no images." &&
          retryCount < MAX_RETRIES
        ) {
          const delay = INITIAL_DELAY * Math.pow(2, retryCount);
          //console.log(`Error: ${error.message}. Retrying in ${delay}ms...`);

          await new Promise((resolve) => setTimeout(resolve, delay));
          return attemptGeneration(retryCount + 1);
        }

        // Either not a retry-eligible error or we've maxed out retries
        throw error;
      }
    };

    // Start the attempt/retry process
    try {
      const newArts = await attemptGeneration(0);

      if (newArts && newArts.length > 0) {
        setVisibleArts((prev) => [...newArts, ...prev]);
        setArts((prev) => [...newArts, ...prev]);

        const storageKey = `arts-generate-${user?.id}`;
        const arts = JSON.parse(localStorage.getItem(`${storageKey}`));
        const updatedArts = [...newArts, ...arts];
        localStorage.setItem(`${storageKey}`, JSON.stringify(updatedArts));

        toast({
          title: "Images generated!",
          status: "success",
        });
      } else {
        // This shouldn't happen due to our retry logic, but just in case
        throw new Error("No images were generated after all attempts");
      }
    } catch (error) {
      //console.error("Generation failed:", error);
      toast({
        title: "Generation failed",
        description:
          error.message || "Could not generate images after multiple attempts.",
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedModels, user, toast]);

  // Custom fetchArts function for ArtGallery
  const fetchArts = useCallback(async () => {
    const storageKey = `arts-generate-${user?.id}`;
    const localArts = localStorage.getItem(`${storageKey}`);

    //console.log("localArts", localArts);

    if (!user && !localArts) {
      //console.log("setting localArts");
      localStorage.setItem(`${storageKey}`, JSON.stringify([]));
      return;
    }

    if (localArts) {
      return;
    }

    const data = await fetchAPI(
      `/arts/generated/${user.id}?viewer_id=${user.id}`
    );

    localStorage.setItem(`${storageKey}`, JSON.stringify(data));

    localStorage.setItem(`${storageKey}-user`, user.id);
  }, [user]);

  const emptyState = (
    <Flex
      justify="center"
      align="center"
      height="50vh"
      direction="column"
      color="gray.400"
    >
      <Icon as={FiImage} boxSize={12} mb={4} />
      <Text>Your generated images will appear here.</Text>
    </Flex>
  );

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
              minHeight="150px"
              bg={inputBg}
              _hover={{ bg: inputHoverBg }}
              _focus={{
                borderColor: focusBorderColor,
                boxShadow: `0 0 0 1px ${focusBorderColor}`,
                bg: inputBg,
              }}
              borderRadius="xl"
            />
          </Box>

          {/* Model Selection */}
          <Box>
            <Text mb="8px" fontWeight="medium">
              Models:
            </Text>
            <Wrap spacing={2}>
              {availableModels.map((model) => {
                const isSelected = selectedModels.includes(model);
                return (
                  <WrapItem key={model}>
                    <Tag
                      size="lg"
                      variant={isSelected ? "solid" : "outline"}
                      colorScheme={isSelected ? undefined : "gray"}
                      bg={isSelected ? selectedTagBg : undefined}
                      color={isSelected ? selectedTagColor : undefined}
                      onClick={() => handleModelToggle(model)}
                      cursor="pointer"
                      borderRadius="full"
                      px={4}
                      py={1.5}
                      borderColor={
                        isSelected
                          ? selectedTagColor
                          : useColorModeValue("gray.200", "gray.600")
                      }
                    >
                      {model}
                    </Tag>
                  </WrapItem>
                );
              })}
            </Wrap>
          </Box>

          {/* Generate Button */}
          <PurpleButton
            name={isLoading ? "Generating..." : "Generate Images"}
            onClick={handleGenerate}
            loading={isLoading}
            // leftIcon={isLoading ? <Spinner size="sm" /> : undefined}
            size="lg"
            w="full"
          />
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
