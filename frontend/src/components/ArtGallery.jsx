import React, { useRef } from "react";
import Gallery from "react-photo-gallery";
import { useNavigate } from "react-router-dom";

const ArtGallery = ({ arts }) => {
  const galleryContainerRef = useRef(null);
  let navigate = useNavigate();

  const handleClick = (event, { photo, index }) => {
    console.log(photo);
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
    navigate(`/art/${photo.id}`, { state: { photo } });
  };

  console.log(arts);

  return (
    <Gallery
      photos={arts.map((art) => ({
        src: art.src,
        width: art.width,
        height: art.height,
        id: art.id,
      }))}
      direction={"column"}
      onClick={handleClick}
    />
  );
};

export default ArtGallery;
