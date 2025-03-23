import React from "react";
import { useParams } from "react-router-dom";
import MainGallery from "./MainGallery";
import ArtDetailPage from "./ArtDetailPage";

const ArtPage = () => {
  const params = useParams();
  console.log("params", params);

  // If no ID is provided, show the gallery
  if (!params.id) {
    return <MainGallery />;
  }

  // Otherwise, show the details page
  return <ArtDetailPage />;
};

export default ArtPage;
