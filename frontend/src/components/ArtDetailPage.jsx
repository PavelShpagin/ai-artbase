import React, {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  VStack,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  useDisclosure,
  Flex,
  Text,
  Spinner,
  Icon,
  useToast,
} from "@chakra-ui/react";
import { IoArrowBackOutline } from "react-icons/io5";
import { GoDownload } from "react-icons/go";
import Heart from "react-heart";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArtGallery } from "./ArtGallery";
import fetchAPI from "../services/api";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";
import { fetchBatchArtData, extractStoredArtIds } from "../services/artService";
import { useUser } from "../contexts/UserContext";
import useArtLikes from "../hooks/useArtLikes";

const ArtDetailPage = () => {
  const { searchQuery } = useSearchQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const [art, setArt] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user } = useUser();
  const prevUserRef = useRef(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const toast = useToast();
  const imageContainerRef = useRef(null);

  // Initialize isLiked and toggleLike
  const [isLiked, setIsLiked] = useState(false);
  const [toggleLikeFunction, setToggleLikeFunction] = useState(() => () => {});

  // Use the hook properly without conditional execution
  const artLikesHook = useArtLikes(
    art?.id || 0,
    user,
    art?.liked_by_user || false
  );

  // Update the local state when art is loaded
  useEffect(() => {
    if (art?.id) {
      setIsLiked(artLikesHook[0]);
      setToggleLikeFunction(() => artLikesHook[1]);
    }
  }, [art, artLikesHook]);

  const fetchSimilarArts = useCallback(async () => {
    try {
      const storageKey = `arts-detail-${location.pathname}`;

      // Check if user has changed and we need to update likes
      if (
        user?.id !== prevUserRef.current?.id &&
        sessionStorage.getItem(storageKey)
      ) {
        const artIds = extractStoredArtIds(storageKey);

        if (artIds.length > 0) {
          const updatedArts = await fetchBatchArtData(
            artIds,
            user,
            `detail-${location.pathname}`
          );

          if (updatedArts) {
            console.log("updatedArts", updatedArts);
            sessionStorage.setItem(storageKey, JSON.stringify(updatedArts));
            // Update visibleArts in sessionStorage with first batch of updatedArts
            const visibleArtsKey = `visibleArts-detail-${location.pathname}`;
            const visibleArtsCount = sessionStorage.getItem(visibleArtsKey)
              ? JSON.parse(sessionStorage.getItem(visibleArtsKey)).length
              : 0;
            sessionStorage.setItem(
              visibleArtsKey,
              JSON.stringify(updatedArts.slice(0, visibleArtsCount))
            );
          }
        }
      }

      // Update previous user reference
      prevUserRef.current = user;

      // Continue with normal fetch if data isn't in session storage
      if (!sessionStorage.getItem(storageKey)) {
        const endpoint = `/arts/similar${location.pathname}${
          user?.id ? `?viewer_id=${user.id}` : ""
        }`;
        const response = await fetchAPI(endpoint);
        const filteredResponse = response.filter(
          (image) => image.id !== parseInt(location.pathname.substring(1))
        );
        sessionStorage.setItem(storageKey, JSON.stringify(filteredResponse));

        // Store current user ID
        localStorage.setItem(
          `arts-detail-${location.pathname}-user`,
          user?.id || "null"
        );
      }
    } catch (error) {
      console.error("Failed to fetch similar arts: " + error.message);
    }
  }, [location.pathname, user]);

  useLayoutEffect(() => {
    const fetchArt = async () => {
      if (location.state?.photo) {
        sessionStorage.setItem(
          `art-showcase-${location.pathname}`,
          JSON.stringify(location.state.photo)
        );
        setArt(location.state?.photo);
        return;
      }
      if (!sessionStorage.getItem(`art-showcase-${location.pathname}`)) {
        const endpoint = `/arts/id${location.pathname}${
          user?.id ? `?viewer_id=${user.id}` : ""
        }`;
        const response = await fetchAPI(endpoint);
        sessionStorage.setItem(
          `art-showcase-${location.pathname}`,
          JSON.stringify(response)
        );

        // Store current user ID
        localStorage.setItem(
          `art-showcase-${location.pathname}-user`,
          user?.id || "null"
        );
        setArt(response);
      } else {
        // Check if user changed and we need to update like status
        const showcaseKey = `art-showcase-${location.pathname}`;
        const storedUserId = localStorage.getItem(`${showcaseKey}-user`);

        if (storedUserId !== String(user?.id || "null")) {
          const artData = JSON.parse(sessionStorage.getItem(showcaseKey));

          if (artData?.id) {
            const updatedArt = await fetchBatchArtData(
              [artData.id],
              user,
              `showcase-${location.pathname}`
            );

            if (updatedArt && updatedArt.length > 0) {
              sessionStorage.setItem(
                showcaseKey,
                JSON.stringify(updatedArt[0])
              );
              setArt(updatedArt[0]);
              return;
            }
          }
        }

        setArt(JSON.parse(sessionStorage.getItem(showcaseKey)));
      }
    };

    setArt(null);
    fetchArt();
  }, [location.pathname, user]);

  // Close modal when location changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location]);

  // Function to go back
  const goBack = (e) => {
    // e.stopPropagation();
    //e.preventDefault();
    navigate(-1);
  };

  // Handle download
  const handleDownload = async (e) => {
    e?.stopPropagation();
    e?.preventDefault();

    if (!art?.src) return;

    try {
      const response = await fetch(art.src);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `image-${art.id}.jpg`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error downloading the image:", error);
      toast({
        title: "Download Failed",
        description: "Error downloading the image. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    }
  };

  // Format prompt into exactly 3 lines
  const getFormattedPrompt = (prompt) => {
    if (!prompt) return "No prompt available";

    // Split the prompt into words
    const words = prompt.replace(/[\n\r]/g, " ").split(" ");
    const totalWords = words.length;

    // Calculate how many words per line (approximately)
    const wordsPerLine = Math.ceil(totalWords / 3);

    // Create the three lines
    const lines = [];
    for (let i = 0; i < 3; i++) {
      const start = i * wordsPerLine;
      const end = Math.min(start + wordsPerLine, totalWords);
      if (start < totalWords) {
        lines.push(words.slice(start, end).join(" "));
      } else {
        lines.push("");
      }
    }

    return lines.join("\n") + "...";
  };

  // Copy prompt to clipboard
  const copyPromptToClipboard = (e) => {
    e.stopPropagation();
    if (!art?.prompt) return;

    navigator.clipboard
      .writeText(art.prompt)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          status: "success",
          duration: 2000,
          isClosable: true,
          position: "top",
        });
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        toast({
          title: "Failed to copy",
          status: "error",
          duration: 2000,
          isClosable: true,
          position: "top",
        });
      });
  };

  // Handle image click
  const handleImageClick = (e) => {
    e.stopPropagation(); // Prevent the click from bubbling up
    onOpen();
  };

  return (
    <>
      <VStack
        spacing={8}
        align="center"
        paddingTop="10px"
        paddingBottom="20px"
        onClick={goBack}
        cursor="pointer"
      >
        <Box
          //position="relative"
          width="fit-content"
          height={{ base: "70vh", md: "80vh" }}
          maxWidth="80vw"
          borderRadius="lg"
          // overflow="hidden"
          display="flex"
          // justifyContent="center"
          alignItems="center"
          ref={imageContainerRef}
          // onClick={handleImageClick} Prevent clicks on the image container from triggering the back navigation
        >
          {art ? (
            <>
              <Box
                position="relative"
                height="100%"
                //maxWidth="80vw"
                width={`min(80vw,${
                  imageContainerRef.current.offsetHeight *
                  (art.width / art.height)
                }px)`}
                background="rgb(229, 231, 235)"
                borderRadius="lg"
                overflow="hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <Box position="relative">
                  {/* Back button positioned on the image */}
                  <Box
                    position="absolute"
                    top="4"
                    left="4"
                    zIndex="10"
                    as="button"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg="rgba(0,0,0,0.3)"
                    color="white"
                    p={2}
                    borderRadius="full"
                    transition="all 0.2s"
                    _hover={{
                      transform: "scale(1.1)",
                      bg: "rgba(0,0,0,0.5)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      goBack();
                    }}
                  >
                    <IoArrowBackOutline size={22} />
                  </Box>
                  <OptimizedImage
                    src={art.src}
                    objectFit="contain"
                    //maxHeight={{ base: "70vh", md: "80vh" }}
                    cursor="zoom-in"
                    borderRadius="lg"
                    loading="lazy"
                    onClick={handleImageClick}
                  />
                </Box>

                {/* Gradient overlay at the bottom */}
                <Box
                  position="absolute"
                  bottom="0"
                  left="0"
                  right="0"
                  height={{ base: "25%", md: "20%" }}
                  background="linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)"
                  borderBottomLeftRadius="lg"
                  borderBottomRightRadius="lg"
                  padding="16px"
                  display="flex"
                  flexDirection="row"
                  alignItems="flex-end"
                  justifyContent="space-between"
                  onClick={handleImageClick}
                >
                  {/* Prompt text */}
                  <Text
                    color="white"
                    fontSize={{ base: "sm", md: "md" }}
                    fontWeight="medium"
                    maxWidth="70%"
                    whiteSpace="pre-line"
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{ opacity: 0.8 }}
                    onClick={copyPromptToClipboard}
                    noOfLines={3}
                    overflow="hidden"
                    textOverflow="ellipsis"
                  >
                    {art.prompt
                      ? getFormattedPrompt(art.prompt)
                      : "No prompt available"}
                  </Text>

                  {/* Action buttons */}
                  <Flex align="center" gap={4}>
                    <Box
                      as="button"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      color="rgba(255, 255, 255, 0.9)"
                      transition="all 0.2s"
                      _hover={{
                        transform: "scale(1.1)",
                        color: "white",
                      }}
                      onClick={handleDownload}
                    >
                      <GoDownload size={24} />
                    </Box>

                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      w="28px"
                      h="28px"
                      onClick={(e) => e.stopPropagation()} // Prevent modal from opening
                    >
                      <Heart
                        isActive={isLiked}
                        onClick={toggleLikeFunction}
                        animationTrigger="both"
                        animationScale={1.2}
                        style={{
                          width: "100%",
                          height: "100%",
                        }}
                        inactiveColor="rgba(255, 255, 255, 0.9)"
                        activeColor="#e53e3e"
                      />
                    </Box>
                  </Flex>
                </Box>
              </Box>
            </>
          ) : (
            <Box display="flex" justifyContent="center" py={4} width="100%">
              <Spinner size="md" thickness="4px" color="gray.200" />
            </Box>
          )}
        </Box>

        <Modal
          isOpen={isOpen}
          onClose={onClose}
          size="full"
          isCentered
          //onOverlayClick={onClose}
          blockScrollOnMount={true}
        >
          <ModalOverlay />
          <ModalContent
            cursor="zoom-out"
            onClick={(e) => {
              e.stopPropagation(); // Stop event from reaching the parent
              onClose();
            }}
            display="flex"
            alignItems="center"
            justifyContent="center"
            // bg="rgba(0, 0, 0, 0.9)"
          >
            {art && (
              <OptimizedImage
                src={art.src}
                objectFit="contain"
                maxH="100vh"
                maxW="100vw"
                // borderRadius="lg"
              />
            )}
          </ModalContent>
        </Modal>
      </VStack>
      <ArtGallery fetchArts={fetchSimilarArts} setArt={setArt} />
    </>
  );
};

export default ArtDetailPage;
