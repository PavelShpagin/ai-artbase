import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import Gallery from "react-photo-gallery";
import { useNavigate, useLocation, useNavigationType } from "react-router-dom";
// import { Box } from "@mui/material";
import { Spinner, Box, Text, useToast } from "@chakra-ui/react";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";
import { useUser } from "../contexts/UserContext";
import { GoDownload } from "react-icons/go";
import Heart from "react-heart";
import fetchAPI from "../services/api";
import useArtLikes from "../hooks/useArtLikes";

// Create a separate component for image rendering
const ImageItem = ({
  photo,
  left,
  top,
  onClick,
  getPathKey,
  setHasRenderedFirstImage,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActionHovered, setIsActionHovered] = useState(false);
  const { user } = useUser();
  const toast = useToast();

  // Use the updated hook to manage liked state
  const [isLiked, toggleLike] = useArtLikes(
    photo.id,
    user,
    photo.liked_by_user
  );

  // Compute combined hover state
  const showOverlay = isHovered || isActionHovered;

  // Handle download
  const handleDownload = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();

    try {
      // Add cache-busting query parameter
      const cacheBustUrl = new URL(photo.src);
      cacheBustUrl.searchParams.set("t", Date.now());

      const response = await fetch(cacheBustUrl, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        // Include credentials if your API requires authentication
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const ephemeralLink = document.createElement("a");
      ephemeralLink.style.display = "none";
      ephemeralLink.href = url;
      ephemeralLink.download = `image-${photo.id}.jpg`;

      document.body.appendChild(ephemeralLink);
      ephemeralLink.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      ephemeralLink.remove();
    } catch (error) {
      console.error("Error downloading the image:", error);
      toast({
        title: "Download failed",
        description: "Error downloading the image. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
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
        width={photo.width * 2}
        height={photo.height * 2}
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
          if (setHasRenderedFirstImage) {
            setHasRenderedFirstImage(true);
          }
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
            onClick={(e) => toggleLike(e)}
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

// Simple component to render a gray placeholder box
const PlaceholderItem = ({ left, top, width, height }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      height,
      backgroundColor: "rgb(229, 231, 235)", // gray-200
      borderRadius: "8px",
    }}
    aria-hidden="true" // Hide placeholders from screen readers
  />
);

export const ArtGallery = ({ fetchArts, setArt }) => {
  const navigate = useNavigate();
  const loaderRef = useRef(null);
  const galleryRef = useRef(null);
  const boxRef = useRef(null);
  const location = useLocation();
  const { searchQuery } = useSearchQuery();
  const { user } = useUser();
  const prevUserRef = useRef(user);
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
  const [hasRenderedFirstImage, setHasRenderedFirstImage] = useState(false);
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
      return `liked-${user?.id}`;
    }
    return location.pathname === "/"
      ? `main-${searchQuery}`
      : `detail-${location.pathname}`;
  }, [location.pathname, searchQuery, user?.id]);

  const prevGetPathKeyRef = useRef(null);
  const prevFetchArtsRef = useRef(null);

  useLayoutEffect(() => {
    if (
      (prevGetPathKeyRef.current !== getPathKey &&
        prevFetchArtsRef.current !== fetchArts) ||
      (user !== prevUserRef.current && prevFetchArtsRef.current !== fetchArts)
    ) {
      if (user !== prevUserRef.current) {
        prevUserRef.current = user;
      }
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
  }, [getPathKey, fetchArts, user]); // Add searchQuery to dependencies

  // // STAGE 1A: Cleaning
  // useLayoutEffect(() => {
  //   if (
  //     stageStatus.stageCleaningComplete ||
  //     stageStatus.stageFetchingComplete ||
  //     stageStatus.stageInitialRenderComplete
  //   )
  //     return;
  //   console.log("START", currentPathRef.current);
  //   setArts([]);
  //   setPage(0);
  //   setVisibleArts([]);
  //   setLayoutHeight(0);
  //   // Mark cleaning as complete
  //   setStageStatus((prev) => ({ ...prev, stageCleaningComplete: true }));
  // }, [stageStatus]);

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
        const storedArts = JSON.parse(localStorage.getItem(`arts-${pathKey}`));

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
    const savedPage = parseInt(sessionStorage.getItem(`page-${pathKey}`), 10);

    //const savedVisibleArts = localStorage.getItem(`visibleArts-${pathKey}`);

    const savedVisibleArts = JSON.parse(localStorage.getItem(`arts-${pathKey}`))
      .slice(0, ITEMS_PER_PAGE * savedPage)
      .map((img) => ({
        id: img.id,
        src: img.src,
        width: parseFloat(img.width) || 1,
        height: parseFloat(img.height) || 1,
        alt: img.title || "Gallery image",
        title: img.title || "Untitled",
        prompt: img.prompt || "",
        liked_by_user: img.liked_by_user || false,
      }));

    console.log("$$$savedVisibleArts", savedVisibleArts);

    if (
      //savedVisibleArts &&
      savedPage &&
      boxRef.current &&
      boxRef.current.offsetHeight == layoutHeight
    ) {
      const savedPosition = parseInt(
        sessionStorage.getItem(`scrollPosition-${pathKey}`),
        10
      );

      if (location.pathname !== currentPathRef.current) return;

      if (!isNaN(savedPosition)) {
        window.scrollTo(0, savedPosition);
      }
      if (location.pathname !== currentPathRef.current) return;
      setVisibleArts(savedVisibleArts);
      if (location.pathname !== currentPathRef.current) return;
      setPage(savedPage);
    } else if (
      //!savedVisibleArts ||
      !savedPage
    ) {
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

      sessionStorage.setItem(`page-${pathKey}`, "1");
      // important
      // sessionStorage.setItem(`visibleArts-${pathKey}`, JSON.stringify(imageData));
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

    const sentinel = loaderRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && arts.length > page * ITEMS_PER_PAGE) {
          setTimeout(() => {
            const nextPageImages = arts.slice(
              page * ITEMS_PER_PAGE,
              (page + 1) * ITEMS_PER_PAGE
            );
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
            //localStorage.setItem(
            //  `visibleArts-${pathKey}`,
            //  JSON.stringify(imageData)
            //);

            if (location.pathname !== currentPathRef.current) return;
            setVisibleArts((prev) => [...prev, ...imageData]);
            setPage((prev) => prev + 1);
          }, 100);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [stageStatus, arts, page, loaderRef, galleryRef, hasRenderedFirstImage]);

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
    setHasRenderedFirstImage(false);
    if (setArt) {
      setArt(null);
    }
    navigate(`/${photo.id}`, { state: { photo } });
  };

  // Custom renderer for images - now passes onFirstLoad to the ImageItem component
  const imageRenderer = ({ index, left, top, key, photo }) => {
    return (
      <ImageItem
        key={`${key}-${index}`}
        photo={photo}
        left={left}
        top={top}
        onClick={handleClick}
        getPathKey={getPathKey}
        setHasRenderedFirstImage={setHasRenderedFirstImage}
      />
    );
  };

  // --- Add placeholder data generation ---
  // const placeholderArts = useMemo(() => {
  //   const ratios = [
  //     { width: 1, height: 1 },
  //     { width: 4, height: 3 },
  //     { width: 3, height: 4 },
  //     { width: 16, height: 9 },
  //     { width: 9, height: 16 },
  //     { width: 3, height: 4 },
  //     { width: 4, height: 3 },
  //     { width: 1, height: 1 },
  //     { width: 16, height: 9 },
  //     { width: 9, height: 16 },
  //     { width: 3, height: 4 },
  //     { width: 4, height: 3 },
  //     { width: 1, height: 1 },
  //     { width: 1, height: 1 },
  //     { width: 4, height: 3 },
  //     { width: 3, height: 4 },
  //     { width: 16, height: 9 },
  //     { width: 9, height: 16 },
  //     { width: 3, height: 4 },
  //     { width: 4, height: 3 },
  //     { width: 1, height: 1 },
  //     { width: 16, height: 9 },
  //     { width: 9, height: 16 },
  //     { width: 3, height: 4 },
  //     { width: 4, height: 3 },
  //     { width: 1, height: 1 },
  //     { width: 1, height: 1 },
  //     { width: 4, height: 3 },
  //     { width: 3, height: 4 },
  //     { width: 16, height: 9 },
  //     { width: 9, height: 16 },
  //     { width: 3, height: 4 },
  //     { width: 4, height: 3 },
  //     { width: 1, height: 1 },
  //     { width: 16, height: 9 },
  //     { width: 9, height: 16 },
  //     { width: 3, height: 4 },
  //     { width: 4, height: 3 },
  //     { width: 1, height: 1 },
  //   ];
  //   return Array.from({ length: ITEMS_PER_PAGE }, (_, i) => ({
  //     id: `placeholder-${i}`,
  //     src: `placeholder-${i}.jpg`, // react-photo-gallery needs a unique src
  //     ...ratios[i % ratios.length], // Cycle through different aspect ratios
  //     alt: "Loading placeholder",
  //   }));
  // }, [ITEMS_PER_PAGE]); // Only depends on ITEMS_PER_PAGE

  // Custom renderer for placeholder items
  // const placeholderRenderer = ({ index, left, top, key, photo }) => {
  //   return (
  //     <PlaceholderItem
  //       key={`${key}-${index}`}
  //       left={left}
  //       top={top}
  //       width={photo.width}
  //       height={photo.height}
  //     />
  //   );
  // };
  // --- End placeholder logic ---

  useEffect(() => {
    setHasRenderedFirstImage(false);
  }, [location.pathname, searchQuery]);

  // --- DOM Check Logic ---
  // Note: Directly querying DOM in render can be fragile. Consider useEffect for robustness.
  // let shouldShowSpinnerBasedOnDOM = false;
  // if (typeof window !== "undefined") {
  //   // Ensure this only runs client-side
  //   const galleryElement = document.querySelector(
  //     ".react-photo-gallery--gallery"
  //   );
  //   if (galleryElement && galleryElement.children.length > 5) {
  //     shouldShowSpinnerBasedOnDOM = true;
  //   }
  // }

  return (
    <>
      <div className="p-4" ref={galleryRef}>
        {/* Layout height placeholder box */}
        <Box
          ref={boxRef}
          height={`${layoutHeight}px`}
          position="absolute"
          width="100%"
          left={0}
          opacity={0}
          pointerEvents="none"
          //aria-hidden="true"
          bg="red"
        />

        {/* ---- Absolute positioned Loading Spinner for Infinite Scroll ---- */}
        {/* Show only after initial gallery is visible AND there are more arts to load AND DOM check passes */}

        {/* ---- Placeholder Gallery ---- */}
        {/* Show only during the initial fetch before any arts are visible */}
        {/* {visibleArts.length === 0 && !stageStatus.stageFetchingComplete && (
          <div className="gallery" aria-hidden="true">
            <Gallery
              photos={placeholderArts}
              direction="column"
              columns={(containerWidth) => {
                if (containerWidth >= 1280) return 6; // xl
                if (containerWidth >= 1024) return 5; // lg
                if (containerWidth >= 768) return 4; // md
                if (containerWidth >= 512) return 3; // sm
                return 2; // default
              }}
              renderImage={placeholderRenderer}
            />
          </div>
        )} */}

        {/* ---- Real Gallery ---- */}
        {/* Show the main gallery once visibleArts has items */}
        {visibleArts.length > 0 && (
          <div className="gallery" onClick={(e) => e.stopPropagation()}>
            <Gallery
              photos={visibleArts}
              direction="column"
              columns={(containerWidth) => {
                if (containerWidth >= 1280) return 6; // xl
                if (containerWidth >= 1024) return 5; // lg
                if (containerWidth >= 768) return 4; // md
                if (containerWidth >= 512) return 3; // sm
                return 2; // default
              }}
              onClick={handleClick}
              renderImage={imageRenderer}
            />
            {/* Infinite scroll spinner - only show after at least one image has rendered */}

            {/* <Box ref={loaderRef} height="1px" /> */}
            {hasRenderedFirstImage &&
              stageStatus.stageInitialRenderComplete &&
              visibleArts.length > 0 &&
              visibleArts.length < arts.length && (
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
        )}

        {/* ---- No Images Message ---- */}
        {/* Show only when fetching is complete and resulted in zero arts */}
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
          (!visibleArts || arts.length === 0 || visibleArts.length === 0) && (
            <>
              {location.pathname === "/" ? (
                <Box width="100%" paddingTop="calc(50vh - 110px)" />
              ) : (
                <Box width="100%" paddingTop="calc(13vh - 90px)" />
              )}
              <Box
                display="flex"
                justifyContent="center"
                width="100%"
                paddingTop="16px"
                paddingBottom="16px"
              >
                <Spinner
                  size={location.pathname === "/" ? "lg" : "md"}
                  thickness={location.pathname === "/" ? "5px" : "4px"}
                  color="gray.200"
                />
              </Box>
            </>
          )}

        {/* {stageStatus.stageInitialRenderComplete &&
          visibleArts.length < arts.length && (
            <Box
              ref={loaderRef}
              display="flex"
              justifyContent="center"
              width="100%"
              paddingTop="16px"
              paddingBottom="16px"
            >
              <Spinner
                size={location.pathname === "/" ? "lg" : "lg"}
                thickness={location.pathname === "/" ? "5px" : "5px"}
                color="gray.200"
              />
            </Box>
          )} */}

        {/* {(arts.length > 0 || !stageStatus.stageFetchingComplete) &&
          (!visibleArts ||
            arts.length === 0 ||
            visibleArts.length < arts.length) && (
            <>
              {visibleArts.length === 0 && location.pathname === "/" && (
                <Box width="100%" paddingTop="40vh" />
              )}
              <Box
                ref={loaderRef}
                display="flex"
                justifyContent="center"
                width="100%"
                paddingTop="16px"
                paddingBottom="16px"
              >
                <Spinner
                  size={location.pathname === "/" ? "lg" : "md"}
                  thickness={location.pathname === "/" ? "5px" : "4px"}
                  color="gray.200"
                />
              </Box>
            </>
          )} */}
      </div>
    </>
  );
};
