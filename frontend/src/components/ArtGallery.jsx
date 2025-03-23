import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import Gallery from "react-photo-gallery";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Box } from "@mui/material";
import { Spinner } from "@chakra-ui/react";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";

const ArtGallery = ({ arts }) => {
  const navigate = useNavigate();
  const loaderRef = useRef(null);
  const galleryRef = useRef(null);
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useSearchQuery();
  const ITEMS_PER_PAGE = 5;

  // Retrieve the page number and visible arts from the cache
  const [page, setPage] = useState(() => {
    if (location.pathname === "/") {
      return parseInt(
        sessionStorage.getItem(`page-/${searchQuery}`) || "1",
        10
      );
    } else {
      return parseInt(
        sessionStorage.getItem(`page-${location.pathname}`) || "1",
        10
      );
    }
  });

  const [scrollPosition, setScrollPosition] = useState(() => {
    if (location.pathname === "/") {
      return parseInt(
        sessionStorage.getItem(`scrollPosition-/${searchQuery}`) || "0",
        10
      );
    } else {
      return parseInt(
        sessionStorage.getItem(`scrollPosition-${location.pathname}`) || "0",
        10
      );
    }
  });

  const [layoutHeight, setLayoutHeight] = useState(() => {
    if (location.pathname === "/") {
      return parseInt(
        sessionStorage.getItem(`layoutHeight-/${searchQuery}`) || "0",
        10
      );
    } else {
      return parseInt(
        sessionStorage.getItem(`layoutHeight-${location.pathname}`) || "0",
        10
      );
    }
  });

  const [visibleArts, setVisibleArts] = useState(() => {
    if (location.pathname === "/") {
      return JSON.parse(
        sessionStorage.getItem(`visibleArts-/${searchQuery}`) || "[]"
      );
    } else {
      return JSON.parse(
        sessionStorage.getItem(`visibleArts-${location.pathname}`) || "[]"
      );
    }
  });

  const [galleryReady, setGalleryReady] = useState(false);

  useEffect(() => {
    if (galleryReady) {
      const firstPageImages = arts.slice(0, page * ITEMS_PER_PAGE);

      // Make sure we store valid data for Gallery component
      const imageData = firstPageImages.map((img) => ({
        id: img.id,
        src: img.src,
        width: parseFloat(img.width) || 1,
        height: parseFloat(img.height) || 1,
        alt: img.title || "Gallery image",
        title: img.title || "Untitled",
      }));

      if (location.pathname === "/") {
        sessionStorage.setItem(`page-/${searchQuery}`, page.toString());
        sessionStorage.setItem(
          `visibleArts-/${searchQuery}`,
          JSON.stringify(imageData)
        );
      } else {
        sessionStorage.setItem(`page-${location.pathname}`, page.toString());
        sessionStorage.setItem(
          `visibleArts-${location.pathname}`,
          JSON.stringify(imageData)
        );
      }
      setVisibleArts(imageData);

      const observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            arts &&
            arts.length > page * ITEMS_PER_PAGE
          ) {
            setTimeout(() => {
              setPage((prev) => prev + 1);
            }, 300);
          }
        },
        { threshold: 0.5 }
      );

      if (loaderRef.current) {
        observer.observe(loaderRef.current);
      }

      return () => observer.disconnect();
    }
  }, [page, galleryReady]);

  useLayoutEffect(() => {
    console.log(
      "TRYING",
      arts,
      visibleArts,
      page,
      layoutHeight,
      !galleryReady,
      location.pathname === "/"
        ? !parseInt(sessionStorage.getItem(`page-/${searchQuery}`), 10)
        : !parseInt(sessionStorage.getItem(`page-${location.pathname}`), 10)
    );
    if (
      arts &&
      arts.length > 0 &&
      (location.pathname === "/"
        ? !parseInt(sessionStorage.getItem(`page-/${searchQuery}`), 10)
        : !parseInt(sessionStorage.getItem(`page-${location.pathname}`), 10))
    ) {
      const firstPageImages = arts.slice(0, ITEMS_PER_PAGE);
      // Make sure we store valid data for Gallery component
      const imageData = firstPageImages.map((img) => ({
        id: img.id,
        src: img.src,
        width: parseFloat(img.width) || 1,
        height: parseFloat(img.height) || 1,
        alt: img.title || "Gallery image",
        title: img.title || "Untitled",
      }));

      if (location.pathname === "/") {
        sessionStorage.setItem(`page-/${searchQuery}`, "1");
        sessionStorage.setItem(
          `visibleArts-/${searchQuery}`,
          JSON.stringify(imageData)
        );
      } else {
        sessionStorage.setItem(`page-${location.pathname}`, "1");
        sessionStorage.setItem(
          `visibleArts-${location.pathname}`,
          JSON.stringify(imageData)
        );
      }
      setVisibleArts(imageData);
      setPage(1);
      setGalleryReady(true);
      return;
    }
    if (
      arts &&
      arts.length > 0 &&
      visibleArts &&
      page &&
      layoutHeight > 0 &&
      !galleryReady
    ) {
      console.log("TRIGGERED");
      let position;
      if (location.pathname === "/") {
        position = parseInt(
          sessionStorage.getItem(`scrollPosition-/${searchQuery}`) || "0",
          10
        );
      } else {
        position = parseInt(
          sessionStorage.getItem(`scrollPosition-${location.pathname}`) || "0",
          10
        );
      }
      window.scrollTo(0, position);
      setTimeout(() => {
        setGalleryReady(true);
      }, 50);
    }
  }, [arts, visibleArts, page, layoutHeight, galleryReady]);

  const handleScroll = () => {
    const currentPosition = window.scrollY;
    if (location.pathname === "/") {
      sessionStorage.setItem(
        `scrollPosition-/${searchQuery}`,
        currentPosition.toString()
      );
    } else {
      sessionStorage.setItem(
        `scrollPosition-${location.pathname}`,
        currentPosition.toString()
      );
    }
    // Store the current layout height when user scrolls
    if (galleryRef.current) {
      const galleryHeight = galleryRef.current.scrollHeight;
      if (location.pathname === "/") {
        sessionStorage.setItem(
          `layoutHeight-/${searchQuery}`,
          galleryHeight.toString()
        );
      } else {
        sessionStorage.setItem(
          `layoutHeight-${location.pathname}`,
          galleryHeight.toString()
        );
      }
      setLayoutHeight(galleryHeight);
    }

    const currentState = window.history.state || {};
    window.history.replaceState(
      { ...currentState, scrollPosition: currentPosition },
      document.title
    );
  };

  // Track scroll position and layout height
  useEffect(() => {
    if (galleryReady) {
      window.addEventListener("scroll", handleScroll);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [galleryReady]);

  // Handle navigation and save scroll position.
  const handleClick = (event, { photo }) => {
    event.stopPropagation();
    console.log("page-/photo.id", sessionStorage.getItem(`page-/${photo.id}`));
    window.removeEventListener("scroll", handleScroll);
    sessionStorage.setItem(`scrollPosition-/${photo.id}`, 0);
    setScrollPosition(0);
    setGalleryReady(false);
    setPage(parseInt(sessionStorage.getItem(`page-/${photo.id}`) || "1", 10));
    setVisibleArts(
      JSON.parse(sessionStorage.getItem(`visibleArts-/${photo.id}`) || "[]")
    );
    setLayoutHeight(
      parseInt(sessionStorage.getItem(`layoutHeight-/${photo.id}`) || "0", 10)
    );
    navigate({ to: `/${photo.id}`, state: { photo } });
  };

  // Custom renderer for images.
  const imageRenderer = ({ index, left, top, key, photo }) => (
    <div
      key={key}
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
        {!galleryReady && layoutHeight > 0 && (
          <div
            style={{
              height: `${layoutHeight}px`,
              position: "absolute",
              width: "100%",
              left: 0,
              opacity: 0,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />
        )}
        {visibleArts && visibleArts.length > 0 && (
          <div className="gallery" onClick={(e) => e.stopPropagation()}>
            <Gallery
              photos={visibleArts}
              direction="column"
              columns={(containerWidth) => {
                if (containerWidth >= 1280) return 5; // xl
                if (containerWidth >= 1024) return 4; // lg
                if (containerWidth >= 512) return 3; // md
                return 2; // default
              }}
              onClick={handleClick}
              renderImage={imageRenderer}
            />
          </div>
        )}

        {(!arts ||
          !arts.response ||
          visibleArts.length < arts.response.length) && (
          <Box
            ref={loaderRef}
            display="flex"
            justifyContent="center"
            py={4}
            width="100%"
          >
            <Spinner size="md" thickness="4px" color="gray.200" />
          </Box>
        )}
      </div>
    </>
  );
};

export default ArtGallery;
