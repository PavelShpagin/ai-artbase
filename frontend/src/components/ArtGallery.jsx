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

  console.log(arts);

  return (
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
    )
  );
};

export default ArtGallery;
