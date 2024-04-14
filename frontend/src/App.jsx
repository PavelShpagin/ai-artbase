
import React from "react";
import { render } from "react-dom";
import Gallery from "react-photo-gallery";
import "./App.css";

const photos = [
  {
    src: "https://source.unsplash.com/2ShvY8Lf6l0/800x599",
    width: 63,
    height: 32,
    id: "unique-photo-id-1",
  },
  {
    src: "https://source.unsplash.com/Dm-qxdynoEc/800x799",
    width: 1,
    height: 1,
    id: "unique-photo-id-2",
  },
  {
    src: "https://source.unsplash.com/qDkso9nvCg0/600x799",
    width: 3,
    height: 4,
    id: "unique-photo-id-3",
  },
];

const handleImageClick = (event, { photo, index }) => {
  console.log("Clicked on photo ID:", photo.id);
};

const App = () => (
  <Gallery photos={photos} direction={"column"} onClick={handleImageClick} />
);

export default App;
