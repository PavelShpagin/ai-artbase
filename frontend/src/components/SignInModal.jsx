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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  Icon,
  Alert,
  AlertIcon,
  AlertDescription,
  InputGroup,
  InputLeftElement,
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

  const inputBg = useColorModeValue("gray.100", "gray.700");
  const inputHoverBg = useColorModeValue("gray.200", "gray.600");
  const focusBorderColor = useColorModeValue("purple.500", "purple.300");
  const modalBg = useColorModeValue("white", "gray.800");
  const secondaryButtonBg = useColorModeValue("gray.100", "gray.700");
  const secondaryButtonHoverBg = useColorModeValue("gray.200", "gray.600");

  const handleClose = () => {
    setEmail("");
    setPassword("");
    setErrors({ email: "", password: "" });
    setError("");
    setLoading(false);
    onClose();
  };

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
      handleClose();
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
    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
  };

  const validateEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSubmit = async () => {
    let hasError = false;
    const newErrors = { email: "", password: "" };

    if (!email) {
      newErrors.email = "Email is required";
      hasError = true;
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
      hasError = true;
    }

    if (!password) {
      newErrors.password = "Password is required";
      hasError = true;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      hasError = true;
    }

    setErrors(newErrors);

    if (!hasError) {
      setError("");
      try {
        setLoading(true);
        const data = await fetchAPI(
          "/token",
          "POST",
          new URLSearchParams({
            username: email,
            password: password,
          }),
          { "Content-Type": "application/x-www-form-urlencoded" }
        );

        localStorage.setItem("token", data.access_token);
        const userData = await fetchAPI("/users/me", "GET", null, {
          Authorization: `Bearer ${data.access_token}`,
        });
        setUser(userData);
        handleClose();
      } catch (err) {
        setError(
          err.message || "Authentication failed. Please check your credentials."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent bg={modalBg} borderRadius="xl" boxShadow="xl">
        <ModalHeader fontWeight="bold" borderTopRadius="xl">
          Sign Up / Sign In
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {error && (
            <Alert status="error" borderRadius="md" mb={4}>
              <AlertIcon as={MdErrorOutline} />
              <AlertDescription fontSize="sm">{error}</AlertDescription>
            </Alert>
          )}

          <VStack spacing={4} align="stretch">
            <FormControl isInvalid={!!errors.email}>
              <InputGroup>
                <Input
                  placeholder="Email"
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  bg={inputBg}
                  _hover={{ bg: inputHoverBg }}
                  _focus={{
                    borderColor: focusBorderColor,
                    boxShadow: `0 0 0 1px ${focusBorderColor}`,
                    bg: inputBg,
                  }}
                  borderRadius="full"
                  size="lg"
                />
              </InputGroup>
              {errors.email && (
                <Text fontSize="xs" color="red.500" mt={1} ml={3}>
                  {errors.email}
                </Text>
              )}
            </FormControl>

            <FormControl isInvalid={!!errors.password}>
              <InputGroup>
                <Input
                  placeholder="Password"
                  id="password"
                  size="lg"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  bg={inputBg}
                  _hover={{ bg: inputHoverBg }}
                  _focus={{
                    borderColor: focusBorderColor,
                    boxShadow: `0 0 0 1px ${focusBorderColor}`,
                    bg: inputBg,
                  }}
                  borderRadius="full"
                />
              </InputGroup>
              {errors.password && (
                <Text fontSize="xs" color="red.500" mt={1} ml={3}>
                  {errors.password}
                </Text>
              )}
            </FormControl>

            <PurpleButton
              name={"Continue"}
              w={"full"}
              onClick={handleSubmit}
              loading={loading}
              size="lg"
              mt={2}
            />

            <Divider orientation="horizontal" my={2} />

            <Button
              leftIcon={<FcGoogle size="1.5em" />}
              variant="outline"
              borderColor={useColorModeValue("gray.300", "gray.600")}
              colorScheme="gray"
              w={"full"}
              onClick={() => googleLogin()}
              borderRadius="full"
              size="lg"
              _hover={{ bg: secondaryButtonHoverBg }}
            >
              Continue with Google
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SignInModal;
