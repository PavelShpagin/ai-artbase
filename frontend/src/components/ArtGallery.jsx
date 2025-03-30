import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import Gallery from "react-photo-gallery";
import { useNavigate, useLocation, useNavigationType } from "react-router-dom";
// import { Box } from "@mui/material";
import { Spinner, Box, Text } from "@chakra-ui/react";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";
import { useUser } from "../contexts/UserContext";
import { GoDownload } from "react-icons/go";
import Heart from "react-heart";
import fetchAPI from "../services/api";

// Create a separate component for image rendering
const ImageItem = ({ photo, left, top, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActionHovered, setIsActionHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const { user } = useUser();

  // Compute combined hover state
  const showOverlay = isHovered || isActionHovered;

  // Check if the image is liked on mount
  useEffect(() => {
    // For authorized users, first check the liked_by_user from API
    if (user?.id) {
      setIsLiked(
        photo.liked_by_user ||
          localStorage.getItem(`like-${photo.id}`) === "true"
      );
    } else {
      // For unauthorized users, only check localStorage
      setIsLiked(localStorage.getItem(`like-${photo.id}`) === "true");
    }
  }, [photo.id, photo.liked_by_user, user]);

  // Handle like/unlike - Fixed by ensuring event exists and using optional chaining
  const handleLike = async (e) => {
    e?.stopPropagation?.(); // Use optional chaining to safely access stopPropagation

    try {
      const endpoint = isLiked
        ? `/arts/unlike/${photo.id}`
        : `/arts/like/${photo.id}`;

      // Change from params object to query string
      const queryString = user?.id ? `?user_id=${user.id}` : "";

      console.log("endpoint", `${endpoint}${queryString}`);

      await fetchAPI(`${endpoint}${queryString}`, "POST");

      // Update localStorage
      if (!isLiked) {
        localStorage.setItem(`like-${photo.id}`, "true");
      } else {
        localStorage.removeItem(`like-${photo.id}`);
      }

      setIsLiked(!isLiked);
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  // Handle download
  const handleDownload = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();

    try {
      const response = await fetch(photo.src);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `image-${photo.id}.jpg`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error downloading the image:", error);
    }
  };

  const getPromptLength = () => {
    if (window.innerWidth >= 1280 + 35) {
      return Math.max(Math.floor(window.innerWidth / 30) - 30, 0); // xl screens
    } else if (window.innerWidth >= 1024 + 35) {
      return Math.max(Math.floor(window.innerWidth / 20) - 42, 0); // lg screens
    } else if (window.innerWidth >= 768 + 35) {
      return Math.max(Math.floor(window.innerWidth / 18) - 40, 0); // md screens
    } else if (window.innerWidth >= 512 + 35) {
      return Math.max(Math.floor(window.innerWidth / 16) - 28, 0); // md screens
    } else {
      return Math.max(Math.floor(window.innerWidth / 16) - 12, 0); // default
    }
  };

  const displayPrompt = photo.prompt
    ? photo.prompt.length > getPromptLength()
      ? photo.prompt
          .substring(0, getPromptLength())
          .trim()
          .replace(/\.*$/, "") + "..."
      : photo.prompt.trim()
    : "...";

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: photo.width,
        height: photo.height,
        background: "rgb(229, 231, 235)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <OptimizedImage
        src={photo.src}
        alt=""
        width={photo.width}
        height={photo.height}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          borderRadius: "8px",
        }}
        loading="lazy"
        onLoad={(e) => {
          e.target.style.opacity = 1;
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e, { photo });
        }}
      />

      {/* Full image gray overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0, 0, 0, 0.09)", // Solid gray with 30% opacity
          borderRadius: "8px",
          pointerEvents: "none",
          opacity: showOverlay ? 1 : 0,
          transition: "opacity 0.05s ease-in-out",
        }}
      />

      {/* Always render the overlay, but control its opacity based on hover state */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
          borderBottomLeftRadius: "8px",
          borderBottomRightRadius: "8px",
          pointerEvents: "none",
          opacity: showOverlay ? 1 : 0,
          transition: "opacity 0.05s ease-in-out",
        }}
      />

      {/* Always render the text and buttons, but control visibility with opacity */}
      <Text
        position="absolute"
        bottom="12px"
        left="10px"
        fontSize="sm"
        fontWeight="medium"
        color="white"
        maxWidth="70%"
        isTruncated
        pointerEvents="none"
        opacity={showOverlay ? 1 : 0}
        transition="opacity 0.05s ease-in-out"
      >
        {displayPrompt}
      </Text>

      {/* Icons container */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          zIndex: 10,
          opacity: showOverlay ? 1 : 0,
          transition: "opacity 0.05s ease-in-out",
        }}
        onMouseEnter={() => setIsActionHovered(true)}
        onMouseLeave={() => setIsActionHovered(false)}
      >
        {/* Download icon */}
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="24px"
          h="24px"
          style={{
            color: "rgba(255, 255, 255, 0.8)",
            transition: "transform 0.05s ease-in-out",
          }}
          _hover={{
            transform: "scale(1.1)",
            color: "white",
          }}
          onClick={handleDownload}
        >
          <GoDownload size={22} />
        </Box>

        {/* Heart icon */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="24px"
          h="24px"
        >
          <Heart
            isActive={isLiked}
            onClick={handleLike}
            animationTrigger="both"
            animationScale={1.1}
            style={{ width: "100%", height: "100%" }}
            inactiveColor="rgba(255, 255, 255, 0.8)"
            activeColor="#e53e3e"
          />
        </Box>
      </div>
    </div>
  );
};

export const ArtGallery = ({ fetchArts, setArt }) => {
  const navigate = useNavigate();
  const loaderRef = useRef(null);
  const galleryRef = useRef(null);
  const boxRef = useRef(null);
  const location = useLocation();
  const { searchQuery } = useSearchQuery();
  const { user } = useUser();
  const ITEMS_PER_PAGE = 20;

  // Stage states
  const [stageStatus, setStageStatus] = useState({
    stageCleaningComplete: false,
    stageFetchingComplete: false,
    stageInitialRenderComplete: false,
  });

  // Gallery states
  const [page, setPage] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [visibleArts, setVisibleArts] = useState([]);
  const [arts, setArts] = useState([]);
  const navType = useNavigationType();

  // Add a ref to track the current path
  const currentPathRef = useRef(location.pathname);

  // Add a new ref to track the latest search query
  const latestSearchQueryRef = useRef(searchQuery);

  // Helper to get current path key
  const getPathKey = useCallback(() => {
    if (location.pathname.startsWith("/profile")) {
      const id = location.pathname.split("/")[2];
      return `profile-${id}`;
    }
    if (location.pathname.startsWith("/liked")) {
      const id = location.pathname.split("/")[2];
      return `liked-${id}`;
    }
    return location.pathname === "/"
      ? `main-${searchQuery}`
      : `detail-${location.pathname}`;
  }, [location.pathname, searchQuery]);

  const prevGetPathKeyRef = useRef(null);
  const prevFetchArtsRef = useRef(null);

  useLayoutEffect(() => {
    if (
      prevGetPathKeyRef.current !== getPathKey &&
      prevFetchArtsRef.current !== fetchArts
    ) {
      console.log("CLEANING");
      prevGetPathKeyRef.current = getPathKey;
      prevFetchArtsRef.current = fetchArts;
      window.removeEventListener("scroll", handleScroll);
      currentPathRef.current = location.pathname;
      latestSearchQueryRef.current = searchQuery; // Update the latest search query

      // Reset all states immediately
      setArts([]);
      setPage(0);
      setVisibleArts([]);
      setLayoutHeight(0);

      setStageStatus({
        stageCleaningComplete: true, // Mark as complete immediately
        stageFetchingComplete: false,
        stageInitialRenderComplete: false,
      });
    }
  }, [getPathKey, fetchArts]); // Add searchQuery to dependencies

  // STAGE 1A: Cleaning
  useLayoutEffect(() => {
    if (
      stageStatus.stageCleaningComplete ||
      stageStatus.stageFetchingComplete ||
      stageStatus.stageInitialRenderComplete
    )
      return;
    console.log("START", currentPathRef.current);
    setArts([]);
    setPage(0);
    setVisibleArts([]);
    setLayoutHeight(0);
    // Mark cleaning as complete
    setStageStatus((prev) => ({ ...prev, stageCleaningComplete: true }));
  }, [stageStatus]);

  // STAGE 1B: Fetching data
  useLayoutEffect(() => {
    if (
      !stageStatus.stageCleaningComplete ||
      stageStatus.stageFetchingComplete ||
      stageStatus.stageInitialRenderComplete
    )
      return;

    const loadData = async () => {
      try {
        const currentSearchQuery = latestSearchQueryRef.current;
        await fetchArts();

        // Check if the search query is still the same
        if (currentSearchQuery !== latestSearchQueryRef.current) {
          return; // Abort if search query changed during fetch
        }

        const pathKey = getPathKey();
        const storedArts = JSON.parse(
          sessionStorage.getItem(`arts-${pathKey}`)
        );

        if (storedArts) {
          setArts(storedArts);
        }

        setLayoutHeight(
          parseInt(sessionStorage.getItem(`layoutHeight-${pathKey}`) || "0", 10)
        );

        setStageStatus((prev) => ({ ...prev, stageFetchingComplete: true }));
      } catch (error) {
        console.error("Error in data loading stage:", error);
      }
    };

    loadData();
  }, [stageStatus, fetchArts]);

  // STAGE 2: Initial rendering
  useLayoutEffect(() => {
    if (
      !stageStatus.stageCleaningComplete ||
      !stageStatus.stageFetchingComplete ||
      stageStatus.stageInitialRenderComplete
    )
      return;

    const currentSearchQuery = latestSearchQueryRef.current;
    const pathKey = getPathKey();

    // Check if the search query is still the same
    if (currentSearchQuery !== latestSearchQueryRef.current) {
      return; // Abort if search query changed
    }

    // Check if we have saved visible arts
    const savedVisibleArts = sessionStorage.getItem(`visibleArts-${pathKey}`);
    const savedPage = sessionStorage.getItem(`page-${pathKey}`);

    if (
      savedVisibleArts &&
      savedPage &&
      boxRef.current &&
      boxRef.current.offsetHeight == layoutHeight
    ) {
      // Restore scroll position if we're coming from a back/forward navigation
      //if (navType === "POP") {
      const savedPosition = parseInt(
        sessionStorage.getItem(`scrollPosition-${pathKey}`),
        10
      );

      if (location.pathname !== currentPathRef.current) return;

      if (!isNaN(savedPosition)) {
        window.scrollTo(0, savedPosition);
      }
      //}
      console.log("!!!locationPathname", location.pathname);
      console.log("!!!currentPathRef.current", currentPathRef.current);
      //console.log("!!!savedVisibleArts", savedVisibleArts);
      // Restore previous state
      if (location.pathname !== currentPathRef.current) return;
      setVisibleArts(JSON.parse(savedVisibleArts));
      if (location.pathname !== currentPathRef.current) return;
      setPage(parseInt(savedPage, 10));
    } else if (!savedVisibleArts || !savedPage) {
      // Create new first page
      const firstPageImages = arts.slice(0, ITEMS_PER_PAGE);
      const imageData = firstPageImages.map((img) => ({
        id: img.id,
        src: img.src,
        width: parseFloat(img.width) || 1,
        height: parseFloat(img.height) || 1,
        alt: img.title || "Gallery image",
        title: img.title || "Untitled",
        prompt: img.prompt || "",
        liked_by_user: img.liked_by_user || false,
      }));

      if (location.pathname !== currentPathRef.current) return;
      setVisibleArts(imageData);
      if (location.pathname !== currentPathRef.current) return;
      setPage(1);

      // Save to session storage
      sessionStorage.setItem(`page-${pathKey}`, "1");
      sessionStorage.setItem(
        `visibleArts-${pathKey}`,
        JSON.stringify(imageData)
      );
    }

    setStageStatus((prev) => ({ ...prev, stageInitialRenderComplete: true }));
  }, [stageStatus, boxRef]);

  // useEffect(() => {
  //   console.log("CURRENT PATH", currentPathRef.current);
  //   console.log("VISIBLE ARTS", visibleArts);
  // }, [visibleArts]);

  // STAGE 3: Infinite scroll setup
  useEffect(() => {
    if (
      !stageStatus.stageInitialRenderComplete ||
      !stageStatus.stageFetchingComplete ||
      !stageStatus.stageCleaningComplete ||
      !loaderRef.current
    )
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && arts.length > page * ITEMS_PER_PAGE) {
          setTimeout(() => {
            const nextPageImages = arts.slice(0, (page + 1) * ITEMS_PER_PAGE);
            const imageData = nextPageImages.map((img) => ({
              id: img.id,
              src: img.src,
              width: parseFloat(img.width) || 1,
              height: parseFloat(img.height) || 1,
              alt: img.title || "Gallery image",
              title: img.title || "Untitled",
              prompt: img.prompt || "",
              liked_by_user: img.liked_by_user || false,
            }));

            const pathKey = getPathKey();
            sessionStorage.setItem(`page-${pathKey}`, (page + 1).toString());
            sessionStorage.setItem(
              `visibleArts-${pathKey}`,
              JSON.stringify(imageData)
            );

            if (location.pathname !== currentPathRef.current) return;
            setVisibleArts(imageData);
            setPage((prev) => prev + 1);
          }, 300);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [stageStatus, arts, page, loaderRef, galleryRef]);

  // Track layout height changes
  useLayoutEffect(() => {
    if (
      !galleryRef.current ||
      !stageStatus.stageInitialRenderComplete ||
      !stageStatus.stageFetchingComplete ||
      !stageStatus.stageCleaningComplete ||
      !boxRef.current ||
      boxRef.current.offsetHeight !== layoutHeight
    )
      return;

    const resizeObserver = new ResizeObserver((entries) => {
      const galleryHeight = entries[0].target.scrollHeight;
      if (galleryHeight > layoutHeight) {
        const pathKey = getPathKey();
        sessionStorage.setItem(
          `layoutHeight-${pathKey}`,
          galleryHeight.toString()
        );
        setLayoutHeight(galleryHeight);
      }
    });

    resizeObserver.observe(galleryRef.current);

    return () => resizeObserver.disconnect();
  }, [stageStatus]);

  // Save scroll position when scrolling
  const handleScroll = useCallback(() => {
    if (
      !stageStatus.stageInitialRenderComplete ||
      !stageStatus.stageFetchingComplete ||
      !stageStatus.stageCleaningComplete
    )
      return;

    const currentPosition = window.scrollY;
    const pathKey = getPathKey();
    sessionStorage.setItem(
      `scrollPosition-${pathKey}`,
      currentPosition.toString()
    );
  }, [stageStatus]);

  // Add scroll event listener when gallery is ready
  useEffect(() => {
    if (
      stageStatus.stageInitialRenderComplete &&
      stageStatus.stageFetchingComplete &&
      stageStatus.stageCleaningComplete
    ) {
      window.addEventListener("scroll", handleScroll);
    }
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [stageStatus, handleScroll]);

  // Handle navigation and save scroll position
  const handleClick = (event, { photo }) => {
    sessionStorage.setItem(`scrollPosition-${"detail-/" + photo.id}`, "0");
    if (setArt) {
      setArt(null);
    }
    navigate(`/${photo.id}`, { state: { photo } });
  };

  // Custom renderer for images - now uses our separate component
  const imageRenderer = ({ index, left, top, key, photo }) => {
    return (
      <ImageItem
        key={`${key}-${index}`}
        photo={photo}
        left={left}
        top={top}
        onClick={handleClick}
      />
    );
  };

  return (
    <>
      <div className="p-4" ref={galleryRef}>
        {
          <Box
            ref={boxRef}
            height={`${layoutHeight}px`}
            position="absolute"
            width="100%"
            left={0}
            opacity={0}
            // bg="black"
            pointerEvents="none"
            //aria-hidden="true"
          />
        }
        {visibleArts && visibleArts.length > 0 && (
          <div className="gallery" onClick={(e) => e.stopPropagation()}>
            <Gallery
              photos={visibleArts}
              direction="column"
              columns={(containerWidth) => {
                if (containerWidth >= 1280) return 6; // xl
                if (containerWidth >= 1024) return 5; // lg
                if (containerWidth >= 768) return 4; // md
                if (containerWidth >= 512) return 3; // md
                return 2; // default
              }}
              onClick={handleClick}
              renderImage={imageRenderer}
            />
          </div>
        )}

        {arts.length === 0 && stageStatus.stageFetchingComplete && (
          <Box
            display="flex"
            justifyContent="center"
            width="100%"
            paddingTop="16px"
            paddingBottom="16px"
          >
            <Text fontSize="lg" color="gray.500">
              No images here yet...
            </Text>
          </Box>
        )}

        {(arts.length > 0 || !stageStatus.stageFetchingComplete) &&
          (!visibleArts ||
            arts.length === 0 ||
            visibleArts.length < arts.length) && (
            <Box
              ref={loaderRef}
              display="flex"
              justifyContent="center"
              width="100%"
              paddingTop="16px"
              paddingBottom="16px"
            >
              <Spinner size="md" thickness="4px" color="gray.200" />
            </Box>
          )}
      </div>
    </>
  );
};
