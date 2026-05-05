import React from "react";
import {
  Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton,
  VStack, HStack, Heading, Text, Button, Icon, Badge, Box, SimpleGrid,
} from "@chakra-ui/react";
import { FiAward, FiCheck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

/**
 * Shown when a non-Pro user tries to access premium gallery / HD download.
 * Pushes them to /pricing.
 */
export default function PaywallModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const goPricing = () => {
    onClose();
    navigate("/pricing");
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay backdropFilter="blur(8px)" />
      <ModalContent borderRadius="xl">
        <ModalCloseButton />
        <ModalBody p={8}>
          <VStack align="stretch" spacing={4}>
            <HStack spacing={2}>
              <Icon as={FiAward} color="purple.500" boxSize={6} />
              <Badge colorScheme="purple" px={2} py={0.5} borderRadius="full">
                Pro only
              </Badge>
            </HStack>
            <Heading size="lg">Unlock the Premium gallery</Heading>
            <Text color="gray.600" fontSize="md">
              The top ~5% of our catalog — hand-picked, scored, and judged. Every image is verified
              against composition, craftsmanship, and our "AI obviousness" rubric.
            </Text>
            <Box bg="purple.50" _dark={{ bg: "purple.900" }} borderRadius="lg" p={4}>
              <SimpleGrid columns={2} spacing={2}>
                {[
                  "Premium gallery (top 5%)",
                  "HD downloads, no watermark",
                  "50 generations / day",
                  "Save to collections",
                ].map((perk) => (
                  <HStack key={perk} spacing={2}>
                    <Icon as={FiCheck} color="green.500" />
                    <Text fontSize="sm">{perk}</Text>
                  </HStack>
                ))}
              </SimpleGrid>
            </Box>
            <Text color="gray.500" fontSize="sm">
              Pro is included with every credit pack. Starts at $5 (7 days) — no recurring billing.
            </Text>
            <Button colorScheme="purple" size="lg" onClick={goPricing}>
              See plans
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
