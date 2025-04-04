import React from "react";
import { Image } from "@chakra-ui/react";

const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  onLoad,
  onError,
  ...props
}) => {
  // Construct the optimized image URL
  // const optimizedSrc = `https://cdn.aiartbase.com/cdn-cgi/image/width=${width},height=${height},fit=contain/${src}`;
  const optimizedSrc = src;

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      onLoad={onLoad}
      onError={onError}
      {...props}
    />
  );
};

export default OptimizedImage;
