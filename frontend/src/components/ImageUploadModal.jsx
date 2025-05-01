import React, { useState } from "react";
import axios from "axios";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Flex,
  Image,
  Textarea,
  ModalFooter,
  Box,
  useDisclosure,
  useColorModeValue,
  FormControl,
  FormErrorMessage,
} from "@chakra-ui/react";
import PurpleButton from "./Buttons";
import fetchAPI from "../services/api";
import { useUser } from "../contexts/UserContext";

const ImageUploadModal = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedFile, setSelectedFile] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [imageWidth, setImageWidth] = useState("auto");
  const [isPublishing, setIsPublishing] = useState(false);
  const { user, setUser } = useUser();

  const inputBg = useColorModeValue("gray.100", "gray.700");
  const inputHoverBg = useColorModeValue("gray.200", "gray.600");
  const focusBorderColor = useColorModeValue("purple.500", "purple.300");
  const modalBg = useColorModeValue("white", "gray.800");

  const handleFilesSelected = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setPrompt("");
      setPromptError(false);
      onOpen();
    }
  };

  const publishImage = async () => {
    if (!prompt || !selectedFile) {
      setPromptError(true);
      return;
    }
    setIsPublishing(true);
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image", selectedFile);
    formData.append("owner_id", user.id);

    try {
      await fetchAPI(`/arts/`, "POST", formData);
      onClose();
      // reset state for next upload
      setPrompt("");
      setSelectedFile(null);
      setImagePreview("");
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleImageLoad = (event) => {
    const aspectRatio = event.target.naturalWidth / event.target.naturalHeight;
    const height = 600;
    const calculatedWidth = height * aspectRatio;
    setImageWidth(`${calculatedWidth}px`);
  };

  return (
    <>
      <input
        type="file"
        id="file-upload"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFilesSelected}
      />
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent maxWidth={imageWidth} bg={modalBg} borderRadius="xl">
          <ModalHeader fontWeight={"bold"} borderTopRadius="xl">
            Upload AI Art
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex direction="column" align="center">
              <Image
                onLoad={handleImageLoad}
                src={imagePreview}
                maxH="600px"
                w={imageWidth}
                objectFit="contain"
              />
              <Textarea
                mt={2}
                placeholder="Enter prompt for this image"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                bg={inputBg}
                _hover={{ bg: inputHoverBg }}
                _focus={{
                  borderColor: focusBorderColor,
                  boxShadow: `0 0 0 1px ${focusBorderColor}`,
                  bg: inputBg,
                }}
                borderRadius="xl"
                size="lg"
                isInvalid={promptError}
                onClick={() => setPromptError(false)}
              />
              {promptError && (
                <Box
                  color="red.500"
                  mt={1}
                  fontSize="sm"
                  alignSelf="flex-start"
                >
                  Prompt cannot be empty.
                </Box>
              )}
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center">
            <PurpleButton
              name={"Publish"}
              onClick={publishImage}
              loading={isPublishing}
            ></PurpleButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ImageUploadModal;
