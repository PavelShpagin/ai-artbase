import React, { useState, useEffect, useRef } from "react";
import Gallery from "react-photo-gallery";
import { useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { Spinner } from "@chakra-ui/react";

const ArtGallery = ({ arts }) => {
  const navigate = useNavigate();
  const [visibleArts, setVisibleArts] = useState([]);
  const loaderRef = useRef(null);
  const ITEMS_PER_PAGE = 20;

  // Initial load
  useEffect(() => {
    window.scrollTo(0, 0);

    if (arts && arts.length > 0) {
      setVisibleArts(arts.slice(0, ITEMS_PER_PAGE));
    }
  }, [arts]);

  // Setup intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleArts.length < arts.length) {
          console.log("visibleArts", visibleArts);
          const startIdx = visibleArts.length;
          const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, arts.length);
          const newArts = arts.slice(startIdx, endIdx);

          setTimeout(() => {
            setVisibleArts((prev) => [...prev, ...newArts]);
          }, 500); // Adding a delay of 500ms before loading more images
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [visibleArts, arts]);

  const handleClick = (event, { photo }) => {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
    navigate(`/art/${photo.id}`, { state: { photo } });
  };

  // Add custom image renderer for the gallery
  const imageRenderer = ({ index, left, top, key, photo }) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left,
        top,
        width: photo.width,
        height: photo.height,
        background: "#f0f0f0", // Lighter gray background placeholder
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <img
        src={photo.src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          borderRadius: "8px",
        }}
        loading="lazy"
        onLoad={(e) => {
          // Once loaded, ensure the image is visible
          e.target.style.opacity = 1;
        }}
      />
    </div>
  );

  // Process arts for gallery
  const processedArts =
    Array.isArray(visibleArts) && visibleArts.length > 0
      ? visibleArts.map((art) => ({
          src: art.src,
          width: art.width || 1, // Default width if missing
          height: art.height || 1, // Default height if missing
          id: art.id,
          key: art.id,
        }))
      : [];

  console.log(visibleArts);

  return (
    <>
      {processedArts.length > 0 && (
        <div className="gallery">
          <Gallery
            photos={processedArts}
            direction={"column"}
            onClick={handleClick}
            renderImage={imageRenderer}
          />
        </div>
      )}

      {visibleArts.length < arts.length && (
        <Box
          ref={loaderRef}
          display="flex"
          justifyContent="center"
          py={4}
          width="100%"
        >
          <Spinner size="md" thickness="4px" color="gray.300" />
        </Box>
      )}
    </>
  );
};

export default ArtGallery;
