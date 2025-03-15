import React, { useRef, useEffect } from "react";
import Gallery from "react-photo-gallery";
import { useNavigate } from "react-router-dom";

const ArtGallery = ({ arts }) => {
  //const galleryContainerRef = useRef(null);
  let navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleClick = (event, { photo, index }) => {
    console.log(photo);
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
    navigate(`/art/${photo.key}`, { state: { photo } });
  };
  console.log(import.meta.env.VITE_CLIENT_ID);

  // Add default dimensions if width/height are missing
  const processedArts =
    Array.isArray(arts) && arts.length > 0
      ? arts.map((art) => ({
          src: art.src,
          width: art.width || 1, // Default width if missing
          height: art.height || 1, // Default height if missing
          id: art.id,
        }))
      : [];

  return (
<<<<<<< HEAD
    processedArts.length > 0 && (
      <div className="gallery">
        <Gallery
          photos={processedArts}
          direction={"column"}
          onClick={handleClick}
        />
      </div>
=======
    Array.isArray(arts) &&
    arts.length > 0 && (
      <Gallery
        photos={arts.map((art) => ({
          src: art.src,
          width: art.width,
          height: art.height,
          key: String(art.id),
        }))}
        direction={"column"}
        onClick={handleClick}
      />
>>>>>>> d8c9af58edabbb75d331a1f228de1d5d4069d5b3
    )
  );
};

export default ArtGallery;
