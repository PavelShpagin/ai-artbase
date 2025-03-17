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
        <ModalContent maxWidth={imageWidth}>
          <ModalHeader fontWeight={"bold"}>Upload AI Art</ModalHeader>
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
                onClick={(e) => setPromptError(false)}
                borderColor={promptError ? "red.500" : undefined}
                borderWidth={2}
              />
              {promptError && (
                <Box color="red.500" mt={1}>
                  This box shouldn't be empty.
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
