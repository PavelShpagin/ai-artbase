import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import Gallery from "react-photo-gallery";
import { useNavigate, useLocation } from "react-router-dom";
import { Box } from "@mui/material";
import { Spinner } from "@chakra-ui/react";
import { useSearchQuery } from "../App";
import OptimizedImage from "./OptimizedImage";

export const ArtGallery = ({ isReady }) => {
  const navigate = useNavigate();
  const loaderRef = useRef(null);
  const galleryRef = useRef(null);
  const boxRef = useRef(null);
  const [isCleaning, setIsCleaning] = useState(true);
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useSearchQuery();
  const ITEMS_PER_PAGE = 20;

  const [page, setPage] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [visibleArts, setVisibleArts] = useState([]);
  const [arts, setArts] = useState([]);
  const [galleryReady, setGalleryReady] = useState(false);

  useLayoutEffect(() => {
    if (!isReady) {
      console.log("cleaning");
      setIsCleaning(true);
      window.removeEventListener("scroll", handleScroll);
      setArts([]);
      setGalleryReady(false);
      setPage(0);
      setVisibleArts([]);
      setLayoutHeight(0);
      setScrollPosition(0);
      setIsCleaning(false);
    }
  }, [isReady]);

  // Separate setup effect
  useLayoutEffect(() => {
    if (!isReady) return; // Early return if not ready
    console.log("loading");
    const currentPath =
      location.pathname === "/"
        ? `main-${searchQuery}`
        : `detail-${location.pathname}`;

    // const storedHeight = Number(
    //   sessionStorage.getItem(`layoutHeight-${currentPath}`)
    // );
    const storedArts = JSON.parse(
      sessionStorage.getItem(`arts-${currentPath}`)
    );

    if (storedArts) {
      //setLayoutHeight(storedHeight);
      setArts(storedArts);
    }
  }, [isReady, location.pathname, searchQuery]);

  console.log("visibleArts", visibleArts.length);
  useEffect(() => {
    if (!loaderRef.current) return;
    if (galleryReady && !isCleaning && arts && arts.length > 0) {
      console.log("setting up observer");
      const observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            arts &&
            arts.length > page * ITEMS_PER_PAGE &&
            !isCleaning
          ) {
            console.log("triggering");
            setTimeout(() => {
              const firstPageImages = arts.slice(
                0,
                (page + 1) * ITEMS_PER_PAGE
              );
              const imageData = firstPageImages.map((img) => ({
                id: img.id,
                src: img.src,
                width: parseFloat(img.width) || 1,
                height: parseFloat(img.height) || 1,
                alt: img.title || "Gallery image",
                title: img.title || "Untitled",
              }));

              console.log("imageData", imageData.length);

              const pathKey =
                location.pathname === "/"
                  ? `main-${searchQuery}`
                  : `detail-${location.pathname}`;
              sessionStorage.setItem(`page-${pathKey}`, page.toString());
              sessionStorage.setItem(
                `visibleArts-${pathKey}`,
                JSON.stringify(imageData)
              );
              setVisibleArts(imageData);
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
  }, [galleryReady, location.pathname, loaderRef, page]);

  useLayoutEffect(() => {
    if (
      arts &&
      arts.length > 0 &&
      !galleryReady &&
      !isCleaning &&
      (location.pathname === "/"
        ? !parseInt(sessionStorage.getItem(`page-${"main-" + searchQuery}`), 10)
        : !parseInt(
            sessionStorage.getItem(`page-${"detail-" + location.pathname}`),
            10
          ))
    ) {
      console.log("creating new page");
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

      const pathKey =
        location.pathname === "/"
          ? `main-${searchQuery}`
          : `detail-${location.pathname}`;

      sessionStorage.setItem(`page-${pathKey}`, "1");
      sessionStorage.setItem(
        `visibleArts-${pathKey}`,
        JSON.stringify(imageData)
      );
      setVisibleArts(imageData);
      setPage(1);
      setGalleryReady(true);

      return;
    }
    if (
      arts &&
      arts.length > 0 &&
      (location.pathname === "/"
        ? sessionStorage.getItem(`visibleArts-${"main-" + searchQuery}`) &&
          sessionStorage.getItem(`page-${"main-" + searchQuery}`)
        : sessionStorage.getItem(
            `visibleArts-${"detail-" + location.pathname}`
          ) &&
          sessionStorage.getItem(`page-${"detail-" + location.pathname}`)) &&
      layoutHeight > 0 &&
      !galleryReady &&
      !isCleaning &&
      boxRef.current
    ) {
      console.log("restoring page");
      let position = 0;
      if (location.pathname === "/") {
        position = parseInt(
          sessionStorage.getItem(`scrollPosition-${"main-" + searchQuery}`),
          10
        );
      } else {
        position = parseInt(
          sessionStorage.getItem(
            `scrollPosition-${"detail-" + location.pathname}`
          ),
          10
        );
      }
      console.log("!!!location.pathname", location.pathname);
      window.scrollTo(0, position);
      if (location.pathname === "/") {
        setVisibleArts(
          JSON.parse(
            sessionStorage.getItem(`visibleArts-${"main-" + searchQuery}`)
          )
        );
        setPage(
          parseInt(sessionStorage.getItem(`page-${"main-" + searchQuery}`), 10)
        );
      } else {
        setVisibleArts(
          JSON.parse(
            sessionStorage.getItem(
              `visibleArts-${"detail-" + location.pathname}`
            )
          )
        );
        setPage(
          parseInt(
            sessionStorage.getItem(`page-${"detail-" + location.pathname}`),
            10
          )
        );
      }
      setTimeout(() => {
        setGalleryReady(true);
      }, 50);
    }
  }, [
    arts,
    layoutHeight,
    boxRef,
    location.pathname,
    isCleaning,
    galleryReady,
    galleryRef,
  ]);

  useLayoutEffect(() => {
    if (!galleryRef.current || isCleaning) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const galleryHeight = entries[0].target.scrollHeight;
      const pathKey =
        location.pathname === "/"
          ? `main-${searchQuery}`
          : `detail-${location.pathname}`;
      sessionStorage.setItem(
        `layoutHeight-${pathKey}`,
        galleryHeight.toString()
      );
      setLayoutHeight(galleryHeight);
    });

    resizeObserver.observe(galleryRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [location.pathname, searchQuery, isCleaning]);

  const handleScroll = () => {
    if (isCleaning) return;
    const currentPosition = window.scrollY;
    console.log("currentPosition", currentPosition);
    if (location.pathname === "/") {
      sessionStorage.setItem(
        `scrollPosition-${"main-" + searchQuery}`,
        currentPosition.toString()
      );
    } else {
      sessionStorage.setItem(
        `scrollPosition-${"detail-" + location.pathname}`,
        currentPosition.toString()
      );
    }
    // Store the current layout height when user scrolls
    // if (galleryRef.current) {
    //   const galleryHeight = galleryRef.current.scrollHeight;
    //   if (location.pathname === "/") {
    //     sessionStorage.setItem(
    //       `layoutHeight-${"main-" + searchQuery}`,
    //       galleryHeight.toString()
    //     );
    //   } else {
    //     sessionStorage.setItem(
    //       `layoutHeight-${"detail-" + location.pathname}`,
    //       galleryHeight.toString()
    //     );
    //   }
    //   setLayoutHeight(galleryHeight);
    // }

    // const currentState = window.history.state || {};
    // window.history.replaceState(
    //   { ...currentState, scrollPosition: currentPosition },
    //   document.title
    // );
  };

  useEffect(() => {
    if (galleryReady && !isCleaning) {
      window.addEventListener("scroll", handleScroll);
    }
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [galleryReady, isCleaning]);

  // Handle navigation and save scroll position.
  const handleClick = (event, { photo }) => {
    sessionStorage.setItem(`scrollPosition-${"detail-/" + photo.id}`, "0");
    navigate(`/${photo.id}`, { state: { photo } });
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

  useEffect(() => {
    console.log("page", page);
  }, [page]);

  return (
    <>
      <div className="p-4" ref={galleryRef}>
        {!galleryReady && layoutHeight > 0 && (
          <div
            ref={boxRef}
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
