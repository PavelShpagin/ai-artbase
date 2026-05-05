import React from "react";
import { Box, HStack, Button, Icon, Badge, Tooltip, useColorModeValue } from "@chakra-ui/react";
import { FiStar, FiAward } from "react-icons/fi";

/**
 * Tier picker shown above the gallery. Two tabs:
 *   "Curated"  - top ~30% (free)
 *   "Premium"  - top ~5% (Pro only). Click while non-Pro -> onPremiumDenied()
 */
export default function TierToggle({ tier, onChange, isPro, onPremiumDenied }) {
  const activeBg = useColorModeValue("purple.500", "purple.400");
  const idleBg = useColorModeValue("gray.100", "gray.700");
  const activeColor = "white";
  const idleColor = useColorModeValue("gray.700", "gray.300");

  const click = (next) => {
    if (next === "premium" && !isPro) {
      onPremiumDenied?.();
      return;
    }
    onChange?.(next);
  };

  return (
    <HStack spacing={1} px={{ base: 4, md: 6 }} mb={3}>
      <Button
        size="sm"
        bg={tier === "curated" ? activeBg : idleBg}
        color={tier === "curated" ? activeColor : idleColor}
        _hover={{ bg: tier === "curated" ? activeBg : idleBg }}
        leftIcon={<Icon as={FiStar} />}
        onClick={() => click("curated")}
        borderRadius="full"
        fontWeight="600"
      >
        Curated
      </Button>
      <Tooltip label={isPro ? "" : "Pro members only — buy any pack to unlock"} placement="top">
        <Button
          size="sm"
          bg={tier === "premium" ? activeBg : idleBg}
          color={tier === "premium" ? activeColor : idleColor}
          _hover={{ bg: tier === "premium" ? activeBg : idleBg }}
          leftIcon={<Icon as={FiAward} />}
          onClick={() => click("premium")}
          borderRadius="full"
          fontWeight="600"
        >
          Premium
          {!isPro && (
            <Badge ml={2} colorScheme="orange" fontSize="2xs" px={1.5} borderRadius="full">
              PRO
            </Badge>
          )}
        </Button>
      </Tooltip>
    </HStack>
  );
}
