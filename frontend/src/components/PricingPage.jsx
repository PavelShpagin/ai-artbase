import React, { useEffect, useState, useContext } from "react";
import {
  Box, Heading, Text, SimpleGrid, VStack, HStack, Button, Badge, Icon, useToast,
} from "@chakra-ui/react";
import { FiCheck, FiZap } from "react-icons/fi";
import { UserContext } from "../contexts/UserContext";

// Lemon Squeezy hosted checkout URLs.
// These are read from Vite env so we can swap them per-environment.
//   VITE_LS_URL_STARTER, VITE_LS_URL_PLUS, VITE_LS_URL_PRO
// Each URL should be the public Lemon Squeezy product checkout URL.
// The user_id is appended as a `checkout[custom][user_id]=N` param so the webhook can credit them.
const PACKS = [
  {
    key: "starter",
    name: "Starter",
    credits: 100,
    proDays: 7,
    price: "$5",
    perImage: "$0.05",
    envKey: "VITE_LS_URL_STARTER",
    perks: [
      "100 image generations",
      "7 days of Pro access",
      "Premium gallery (top 5%)",
      "HD downloads, no watermark",
    ],
  },
  {
    key: "plus",
    name: "Plus",
    credits: 350,
    proDays: 30,
    price: "$15",
    perImage: "$0.043",
    envKey: "VITE_LS_URL_PLUS",
    badge: "Best value",
    perks: [
      "350 image generations",
      "30 days of Pro access",
      "Premium gallery (top 5%)",
      "HD downloads, no watermark",
      "Save to collections",
    ],
  },
  {
    key: "pro",
    name: "Studio",
    credits: 1000,
    proDays: 90,
    price: "$40",
    perImage: "$0.04",
    envKey: "VITE_LS_URL_PRO",
    perks: [
      "1,000 image generations",
      "90 days of Pro access",
      "Premium gallery (top 5%)",
      "HD downloads, no watermark",
      "Save to collections",
      "Priority queue",
    ],
  },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.aiartbase.com";

function buildCheckoutUrl(baseUrl, userId) {
  if (!baseUrl) return null;
  const u = new URL(baseUrl);
  if (userId) u.searchParams.set("checkout[custom][user_id]", String(userId));
  return u.toString();
}

export default function PricingPage() {
  const { user } = useContext(UserContext) || {};
  const userId = user?.id;
  const toast = useToast();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/credits/balance/${userId}`)
      .then((r) => r.json())
      .then((data) => setBalance(data))
      .catch(() => {});
  }, [userId]);

  const onBuy = (pack) => {
    const url = buildCheckoutUrl(import.meta.env[pack.envKey], userId);
    if (!url) {
      toast({
        status: "warning",
        title: "Checkout not configured yet",
        description: `Set ${pack.envKey} in your frontend env once you have the Lemon Squeezy product URL.`,
      });
      return;
    }
    if (!userId) {
      toast({ status: "info", title: "Sign in first", description: "Create an account so we can credit your purchase." });
      return;
    }
    window.location.href = url;
  };

  return (
    <Box maxW="1200px" mx="auto" px={6} py={12}>
      <VStack spacing={3} mb={10} textAlign="center">
        <Heading size="2xl">One purchase. Credits + Pro access.</Heading>
        <Text color="gray.500" fontSize="lg" maxW="640px">
          Every pack unlocks both image-generation credits and time-bound access to the
          Premium gallery (top 5% of our judged catalog) + HD downloads. No subscription, no auto-renew.
        </Text>
        {balance && (
          <HStack mt={2}>
            <Badge colorScheme="purple" px={3} py={1} borderRadius="full">
              <Icon as={FiZap} mr={1} /> {balance.balance} credits
            </Badge>
            <Badge colorScheme="green" px={3} py={1} borderRadius="full">
              {balance.free_remaining_today}/{balance.free_per_day} free today
            </Badge>
          </HStack>
        )}
      </VStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        {PACKS.map((p) => (
          <Box
            key={p.key}
            bg="white"
            _dark={{ bg: "gray.800" }}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={p.badge ? "purple.400" : "gray.200"}
            p={6}
            position="relative"
            shadow={p.badge ? "lg" : "sm"}
          >
            {p.badge && (
              <Badge
                position="absolute"
                top={-3}
                left="50%"
                transform="translateX(-50%)"
                colorScheme="purple"
                px={3}
                py={1}
                borderRadius="full"
              >
                {p.badge}
              </Badge>
            )}
            <VStack align="stretch" spacing={4}>
              <Heading size="md">{p.name}</Heading>
              <HStack align="baseline">
                <Text fontSize="4xl" fontWeight="bold">{p.price}</Text>
                <Text color="gray.500">one-time</Text>
              </HStack>
              <Text color="gray.500" fontSize="sm">{p.credits} credits • {p.perImage}/image</Text>
              <VStack align="start" spacing={2} pt={2}>
                {p.perks.map((perk) => (
                  <HStack key={perk} spacing={2}>
                    <Icon as={FiCheck} color="green.500" />
                    <Text fontSize="sm">{perk}</Text>
                  </HStack>
                ))}
              </VStack>
              <Button
                colorScheme={p.badge ? "purple" : "gray"}
                onClick={() => onBuy(p)}
                size="lg"
                mt={2}
              >
                Buy {p.credits} credits
              </Button>
            </VStack>
          </Box>
        ))}
      </SimpleGrid>

      <Box mt={10} textAlign="center" color="gray.500" fontSize="sm">
        Payments processed by Lemon Squeezy (Merchant of Record). VAT/GST handled automatically.
      </Box>
    </Box>
  );
}
