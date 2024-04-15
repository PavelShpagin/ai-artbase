import React, { useState } from "react";
import {
  Box,
  Button,
  Input,
  Stack,
  Text,
  VStack,
  useColorModeValue,
  Divider,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Icon,
} from "@chakra-ui/react";
import { FcGoogle } from "react-icons/fc";
import PurpleButton from "./Buttons";
import { useGoogleLogin } from "@react-oauth/google";
import fetchAPI from "../services/api";
import { MdErrorOutline } from "react-icons/md";
import { useUser } from "../contexts/UserContext";

const SignInModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, setUser } = useUser();

  const handleGoogleSuccess = async (response) => {
    try {
      console.log(response.access_token);

      const data = await fetchAPI(
        "/auth/google",
        "POST",
        JSON.stringify({
          access_token: response.access_token,
        }),
        {
          "Content-Type": "application/json",
        }
      );

      console.log("User authenticated:", data);
      localStorage.setItem("token", data.access_token);
      const userData = await fetchAPI("/users/me", "GET", null, {
        Authorization: `Bearer ${data.access_token}`,
      });
      setUser(userData);
      onClose();
    } catch (error) {
      console.error("Error during Google login:", error);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => console.log("Google login failed"),
  });

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const validateEmail = (email) => {
    return /\S+@\S+\.com/.test(email);
  };

  const handleSubmit = async () => {
    let errorFlag = false;
    if (!email) {
      setErrors((prev) => ({ ...prev, email: "Fill in your email" }));
      errorFlag = true;
    } else if (!validateEmail(email)) {
      setErrors((prev) => ({ ...prev, email: "Invalid email" }));
      errorFlag = true;
    } else {
      setErrors((prev) => ({ ...prev, email: "" }));
    }

    if (password.length < 6) {
      setErrors((prev) => ({ ...prev, password: "Should be 6+ characters" }));
      errorFlag = true;
    } else {
      setErrors((prev) => ({ ...prev, password: "" }));
    }

    if (!errorFlag) {
      try {
        setLoading(true);
        const data = await fetchAPI(
          "/token",
          "POST",
          new URLSearchParams({
            username: email,
            password: password,
          }),
          {
            "Content-Type": "application/x-www-form-urlencoded",
          }
        );
        console.log("Authentication successful:", data);
        localStorage.setItem("token", data.access_token);
        const userData = await fetchAPI("/users/me", "GET", null, {
          Authorization: `Bearer ${data.access_token}`,
        });
        setUser(userData);
        console.log(userData);
        setError("");
        setEmail("");
        setPassword("");
        onClose();
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontWeight="bold">Sign Up</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {error && (
            <Box
              fontWeight="500"
              background="red.100"
              borderRadius="md"
              paddingY="2"
              paddingX="4"
              display="flex"
              alignItems="center"
            >
              <Icon as={MdErrorOutline} color="red.500" marginRight="2" />
              <Text color="red.500" fontSize="sm">
                {error}
              </Text>
            </Box>
          )}

          <VStack spacing={4} align={"flex-start"}>
            <Stack direction={"column"} spacing={2} width={"full"}>
              <FormControl>
                <FormLabel htmlFor="email"></FormLabel>
                <Input
                  placeholder="Email"
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  list="email-suggestions"
                  borderColor={errors.email ? "red.500" : undefined}
                />
              </FormControl>

              {errors.email && (
                <Box display="flex" alignItems="center" color="red.500">
                  <Icon as={MdErrorOutline} marginRight={2} />
                  <Text fontWeight="500">{errors.email}</Text>
                </Box>
              )}

              <FormControl>
                <Input
                  placeholder="Password"
                  size="md"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  borderColor={errors.password ? "red.500" : undefined}
                />
              </FormControl>
              {errors.password && (
                <Box display="flex" alignItems="center" color="red.500">
                  <Icon as={MdErrorOutline} marginRight={2} />
                  <Text fontWeight="500">{errors.password}</Text>
                </Box>
              )}
              <PurpleButton
                name={"Sign Up"}
                w={"full"}
                onClick={handleSubmit}
                loading={loading}
              />
              <Divider orientation="horizontal" my={1} />
              <Button
                leftIcon={<FcGoogle />}
                colorScheme="gray"
                variant="solid"
                w={"full"}
                onClick={() => googleLogin()}
                borderRadius="full"
                size="lg"
                mt={1}
                mb={2}
              >
                Sign in with Google
              </Button>
            </Stack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SignInModal;
