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
import { Spinner, Box } from "@chakra-ui/react";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";

export const ArtGallery = ({ fetchArts }) => {
  const navigate = useNavigate();
  const loaderRef = useRef(null);
  const galleryRef = useRef(null);
  const boxRef = useRef(null);
  const location = useLocation();
  const { searchQuery } = useSearchQuery();
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

  // Helper to get current path key
  const getPathKey = useCallback(() => {
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
      prevGetPathKeyRef.current = getPathKey;
      prevFetchArtsRef.current = fetchArts;
      window.removeEventListener("scroll", handleScroll);
      setStageStatus({
        stageCleaningComplete: false,
        stageFetchingComplete: false,
        stageInitialRenderComplete: false,
      });
    }
  }, [getPathKey, fetchArts]);

  // STAGE 1A: Cleaning
  useLayoutEffect(() => {
    if (
      stageStatus.stageCleaningComplete ||
      stageStatus.stageFetchingComplete ||
      stageStatus.stageInitialRenderComplete
    )
      return;
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
        // Fetch arts from API if needed
        await fetchArts();

        // Load arts from sessionStorage
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

        // Mark fetching as complete
        setStageStatus((prev) => ({ ...prev, stageFetchingComplete: true }));
      } catch (error) {
        console.error("Error in data loading stage:", error);
      }
    };

    loadData();
  }, [stageStatus]);

  // STAGE 2: Initial rendering
  useLayoutEffect(() => {
    if (
      !stageStatus.stageCleaningComplete ||
      !stageStatus.stageFetchingComplete ||
      stageStatus.stageInitialRenderComplete
    )
      return;

    const pathKey = getPathKey();

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
      if (navType === "POP") {
        const savedPosition = parseInt(
          sessionStorage.getItem(`scrollPosition-${pathKey}`),
          10
        );
        if (!isNaN(savedPosition)) {
          window.scrollTo(0, savedPosition);
        }
      }
      // Restore previous state
      setVisibleArts(JSON.parse(savedVisibleArts));
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
      }));

      setVisibleArts(imageData);
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
            }));

            const pathKey = getPathKey();
            sessionStorage.setItem(`page-${pathKey}`, (page + 1).toString());
            sessionStorage.setItem(
              `visibleArts-${pathKey}`,
              JSON.stringify(imageData)
            );

            setVisibleArts(imageData);
            setPage((prev) => prev + 1);

            // // Update layout height after new images are loaded
            // if (galleryRef.current) {
            //   const newHeight = galleryRef.current.scrollHeight;
            //   console.log("!!!newHeight", newHeight);
            //   sessionStorage.setItem(
            //     `layoutHeight-${pathKey}`,
            //     newHeight.toString()
            //   );
            //   setLayoutHeight(newHeight);
            // }
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
    // sessionStorage.setItem(`scrollPosition-${"detail-/" + photo.id}`, "0");
    navigate(`/${photo.id}`, { state: { photo } });
  };

  // Custom renderer for images
  const imageRenderer = ({ index, left, top, key, photo }) => (
    <div
      key={`${key}-${index}`}
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
          handleClick(e, { photo });
        }}
      />
    </div>
  );

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
                if (containerWidth >= 512) return 4; // md
                return 2; // default
              }}
              onClick={handleClick}
              renderImage={imageRenderer}
            />
          </div>
        )}

        {(!arts ||
          !visibleArts ||
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
