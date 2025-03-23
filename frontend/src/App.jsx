// // // import React, { createContext, useState, useContext } from "react";
// // // import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// // // import { QueryClient } from "@tanstack/react-query";
// // // import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
// // // import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
// // // import { ChakraProvider, Box, ColorModeScript } from "@chakra-ui/react";
// // // import { GoogleOAuthProvider } from "@react-oauth/google";
// // // import UserProvider from "./contexts/UserContext";
// // // import Header from "./components/Header";
// // // import ImageUploadModal from "./components/ImageUploadModal";
// // // import ArtPage from "./components/ArtPage";
// // // import AnalyticsPage from "./components/AnalyticsPage";
// // // import AdminTab from "./components/AdminTab";
// // // import UserProfile from "./components/UserProfile";
// // // import theme from "./theme";
// // // import "./App.css";

// // // // Create a context to share the search query across routes
// // // const SearchQueryContext = createContext();

// // // export const SearchQueryProvider = ({ children }) => {
// // //   const [searchQuery, setSearchQuery] = useState("");
// // //   return (
// // //     <SearchQueryContext.Provider value={{ searchQuery, setSearchQuery }}>
// // //       {children}
// // //     </SearchQueryContext.Provider>
// // //   );
// // // };

// // // export const useSearchQuery = () => useContext(SearchQueryContext);

// // // const

// // // const queryClient = new QueryClient({
// // //   defaultOptions: {
// // //     queries: {
// // //       staleTime: 5 * 60 * 1000, // 5 minutes as default stale time
// // //       cacheTime: 10 * 60 * 1000, // 10 minutes as default cache time
// // //       refetchOnWindowFocus: false,
// // //       refetchOnMount: false,
// // //     },
// // //   },
// // // });

// // // const persister = createSyncStoragePersister({
// // //   storage: window.localStorage,
// // //   key: "art-gallery-cache", // unique key for localStorage
// // //   throttleTime: 1000, // don't write to localStorage more than once per second
// // // });

// // // function App() {
// // //   return (
// // //     <PersistQueryClientProvider
// // //       client={queryClient}
// // //       persistOptions={{ persister }}
// // //       onSuccess={() => {
// // //         console.log("Cache restored from localStorage");
// // //       }}
// // //     >
// // //       <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}>
// // //         <ChakraProvider theme={theme}>
// // //           <UserProvider>
// // //             <ColorModeScript initialColorMode={theme.config.initialColorMode} />
// // //             <SearchQueryProvider>
// // //               <Router>
// // //                 <Header />
// // //                 <ImageUploadModal />
// // //                 <Box pt={84}>
// // //                   <Routes>
// // //                     <Route path="/:id?" element={<ArtPage />} />
// // //                     <Route path="/analytics" element={<AnalyticsPage />} />
// // //                     <Route path="/admin" element={<AdminTab />} />
// // //                     <Route path="/profile" element={<UserProfile />} />
// // //                   </Routes>
// // //                 </Box>
// // //               </Router>
// // //             </SearchQueryProvider>
// // //           </UserProvider>
// // //         </ChakraProvider>
// // //       </GoogleOAuthProvider>
// // //     </PersistQueryClientProvider>
// // //   );
// // // }

// // // export default App;

import React, { createContext, useState, useContext } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ChakraProvider, Box, ColorModeScript } from "@chakra-ui/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import UserProvider from "./contexts/UserContext";
import Header from "./components/Header";
import ImageUploadModal from "./components/ImageUploadModal";
import AnalyticsPage from "./components/AnalyticsPage";
import AdminTab from "./components/AdminTab";
import UserProfile from "./components/UserProfile";
import theme from "./theme";
import "./App.css";
import ArtDetailPage from "./components/ArtDetailPage";
import MainGallery from "./components/MainGallery";
import { Outlet } from "@tanstack/react-router";

// Create a context to share the search query across routes
const SearchQueryContext = createContext();

export const SearchQueryProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <SearchQueryContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchQueryContext.Provider>
  );
};

export const useSearchQuery = () => useContext(SearchQueryContext);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes as default stale time
      cacheTime: 10 * 60 * 1000, // 10 minutes as default cache time
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.sessionStorage,
  key: "art-gallery-cache", // unique key for localStorage
  throttleTime: 1000, // don't write to localStorage more than once per second
});

// Define routes using TanStack Router
const rootRoute = createRootRoute({
  component: () => (
    <div>
      <Header />
      <ImageUploadModal />
      <Box pt={84}>
        <Outlet />
      </Box>
    </div>
  ),
});

const mainGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: MainGallery,
});

const artDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$id",
  component: ArtDetailPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminTab,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: UserProfile,
});

// Create router
const router = createRouter({
  routeTree: rootRoute.addChildren([
    mainGalleryRoute,
    artDetailRoute,
    analyticsRoute,
    adminRoute,
    profileRoute,
  ]),
  // scrollRestoration: true,
});

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
      onSuccess={() => {
        console.log("Cache restored from localStorage");
      }}
    >
      <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}>
        <ChakraProvider theme={theme}>
          <UserProvider>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <SearchQueryProvider>
              <RouterProvider router={router} />
            </SearchQueryProvider>
          </UserProvider>
        </ChakraProvider>
      </GoogleOAuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;

// import React, {
//   useState,
//   createContext,
//   useContext,
//   useEffect,
//   useRef,
//   useLayoutEffect,
// } from "react";
// import {
//   createRootRoute,
//   createRoute,
//   createRouter,
//   RouterProvider,
//   Link,
//   Outlet,
// } from "@tanstack/react-router";
// import { QueryClient, useQuery } from "@tanstack/react-query";
// import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
// import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
// import Gallery from "react-photo-gallery";
// // Create a context for shared state
// const SharedStateContext = createContext();

// const SharedStateProvider = ({ children }) => {
//   const [sharedData, setSharedData] = useState("Initial shared data");

//   return (
//     <SharedStateContext.Provider value={{ sharedData, setSharedData }}>
//       {children}
//     </SharedStateContext.Provider>
//   );
// };

// // Add these mock data utilities at the top level
// const simulateNetworkDelay = () =>
//   new Promise((resolve) => setTimeout(resolve, Math.random() * 1500 + 500)); // Random delay between 500-2000ms

// const simulateNetworkError = () => Math.random() < 0.1; // 10% chance of error

// const generateMockLinks = async () => {
//   try {
//     // Simulate network delay
//     await simulateNetworkDelay();

//     // Simulate random network error
//     if (simulateNetworkError()) {
//       throw new Error("Failed to fetch links");
//     }

//     // Generate mock data
//     const links = Array.from({ length: 1000 }, (_, i) => ({
//       id: i + 1,
//       title: `Link ${i + 1}`,
//       url: `https://example.com/link-${i + 1}`,
//       description: `Description for link ${i + 1}`,
//       category: ["Tech", "News", "Social"][Math.floor(Math.random() * 3)],
//     }));

//     return links;
//   } catch (error) {
//     throw new Error("Failed to fetch links: " + error.message);
//   }
// };

// // Define components as functional components
// const Home = () => (
//   <div className="p-4">
//     <h2 className="text-2xl font-bold mb-4">Home</h2>
//     <p className="mb-4">
//       Welcome to the Home page! This is a simple application to demonstrate
//       navigation between different pages using TanStack Router.
//     </p>
//     <p className="mb-4">
//       Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
//       tempor incididunt ut labore et dolore magna aliqua.
//     </p>
//     <div className="mt-4 space-y-2">
//       <Link to="/about" className="text-blue-500 hover:underline block">
//         Go to About
//       </Link>
//       <Link to="/contact" className="text-blue-500 hover:underline block">
//         Go to Contact
//       </Link>
//     </div>
//   </div>
// );

// const About = () => (
//   <div className="p-4">
//     <h2 className="text-2xl font-bold mb-4">About</h2>
//     <p className="mb-4">
//       This is the About page. Here you can find more information about this
//       application and its purpose.
//     </p>
//     <div className="mt-4 space-y-2">
//       <Link to="/" className="text-blue-500 hover:underline block">
//         Go to Home
//       </Link>
//       <Link to="/contact" className="text-blue-500 hover:underline block">
//         Go to Contact
//       </Link>
//     </div>
//   </div>
// );

// const Contact = () => {
//   const { sharedData } = useContext(SharedStateContext);

//   // Use React Query to fetch links with retry configuration
//   const [links, setLinks] = useState([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [isError, setIsError] = useState(false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const fetchLinks = async () => {
//       setIsLoading(true);
//       setIsError(false);
//       try {
//         const data = await generateMockLinks();
//         setLinks(data);
//       } catch (err) {
//         setIsError(true);
//         setError(err);
//       }
//       setIsLoading(false);
//     };

//     fetchLinks();
//   }, []);

//   if (isLoading) {
//     return (
//       <div className="p-4">
//         <div className="animate-pulse space-y-4">
//           {[...Array(6)].map((_, i) => (
//             <div key={i} className="space-y-3">
//               <div className="h-4 bg-gray-200 rounded w-3/4"></div>
//               <div className="h-4 bg-gray-200 rounded w-1/2"></div>
//             </div>
//           ))}
//         </div>
//       </div>
//     );
//   }

//   if (isError) {
//     return (
//       <div className="p-4">
//         <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
//           <h3 className="text-red-800 font-medium">Error loading links</h3>
//           <p className="text-red-600 mt-1">{error.message}</p>
//           <button
//             onClick={() => refetch()}
//             className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
//           >
//             Try Again
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-4">
//       <h2 className="text-2xl font-bold mb-4">Contact</h2>
//       <p className="mb-4">
//         This is the Contact page. Shared data: {sharedData}
//       </p>

//       <div className="mt-8">
//         <div className="flex justify-between items-center mb-4">
//           <h3 className="text-xl font-semibold">Links ({links?.length})</h3>
//           <button
//             onClick={() => refetch()}
//             className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
//           >
//             Refresh
//           </button>
//         </div>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           {links?.map((link) => (
//             <div
//               key={link.id}
//               className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
//             >
//               <a
//                 href={link.url}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="text-blue-600 hover:underline font-medium"
//               >
//                 {link.title}
//               </a>
//               <p className="text-sm text-gray-600 mt-1">{link.description}</p>
//               <span className="inline-block mt-2 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
//                 {link.category}
//               </span>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="mt-8 space-x-4">
//         <Link to="/" className="text-blue-500 hover:underline">
//           Go to Home
//         </Link>
//         <Link to="/about" className="text-blue-500 hover:underline">
//           Go to About
//         </Link>
//       </div>
//     </div>
//   );
// };

// const fetchImages = async () => {
//   try {
//     await simulateNetworkDelay();

//     // Use your actual API endpoint
//     const response = await fetch(`http://localhost:8000/arts/`);

//     if (!response.ok) {
//       throw new Error("Network response was not ok");
//     }
//     const data = await response.json();
//     console.log(data);
//     return data;
//   } catch (error) {
//     throw new Error("Failed to fetch images: " + error.message);
//   }
// };

// const ImageGallery = () => {
//   // Reference to track when component is mounted
//   const isMounted = useRef(false);
//   const galleryRef = useRef(null);
//   const [galleryReady, setGalleryReady] = useState(false);

//   // State for tracking page and visible images
//   const [page, setPage] = useState(() => {
//     return parseInt(sessionStorage.getItem("page") || "1", 10);
//   });
//   const ITEMS_PER_PAGE = 20;

//   const loaderRef = useRef(null);

//   // Store scroll position in state
//   const [scrollPosition, setScrollPosition] = useState(() => {
//     return parseInt(sessionStorage.getItem("scrollPosition") || "0", 10);
//   });

//   // Also load the layout height from sessionStorage
//   const [layoutHeight, setLayoutHeight] = useState(() => {
//     return parseInt(sessionStorage.getItem("layoutHeight") || "0", 10);
//   });

//   const [visibleImages, setVisibleImages] = useState(() => {
//     return JSON.parse(sessionStorage.getItem("visibleImages") || "[]");
//   });

//   // Use React Query to fetch images
//   const {
//     data: images,
//     isLoading,
//     isError,
//     error,
//     refetch,
//   } = useQuery({
//     queryKey: ["images"],
//     queryFn: async () => {
//       const data = await fetchImages();
//       // Ensure all images have width and height
//       return data.map((img) => ({
//         ...img,
//         width: parseFloat(img.width) || 1,
//         height: parseFloat(img.height) || 1,
//       }));
//     },
//     staleTime: 5 * 60 * 1000,
//   });

//   // Update sessionStorage when page or images change
//   useEffect(() => {
//     if (galleryReady) {
//       const firstPageImages = images.slice(0, page * ITEMS_PER_PAGE);

//       // Make sure we store valid data for Gallery component
//       const imageData = firstPageImages.map((img) => ({
//         src: img.src,
//         width: parseFloat(img.width) || 1,
//         height: parseFloat(img.height) || 1,
//         alt: img.title || "Gallery image",
//         title: img.title || "Untitled",
//       }));

//       sessionStorage.setItem("page", page.toString());
//       sessionStorage.setItem("visibleImages", JSON.stringify(imageData));
//       setVisibleImages(imageData);

//       const observer = new IntersectionObserver(
//         (entries) => {
//           if (
//             entries[0].isIntersecting &&
//             images &&
//             images.length > page * ITEMS_PER_PAGE
//           ) {
//             setTimeout(() => {
//               setPage((prev) => prev + 1);
//             }, 300);
//           }
//         },
//         { threshold: 0.5 }
//       );

//       if (loaderRef.current) {
//         observer.observe(loaderRef.current);
//       }

//       return () => observer.disconnect();
//     }
//   }, [page, galleryReady]);

//   useLayoutEffect(() => {
//     console.log("!images", images);
//     console.log(
//       "!sessionStorage.getItem('page')",
//       sessionStorage.getItem("page")
//     );
//     if (images && !parseInt(sessionStorage.getItem("page"), 10)) {
//       const firstPageImages = images.slice(0, ITEMS_PER_PAGE);

//       // Make sure we store valid data for Gallery component
//       const imageData = firstPageImages.map((img) => ({
//         src: img.src,
//         width: parseFloat(img.width) || 1,
//         height: parseFloat(img.height) || 1,
//         alt: img.title || "Gallery image",
//         title: img.title || "Untitled",
//       }));

//       sessionStorage.setItem("page", "1");
//       sessionStorage.setItem("visibleImages", JSON.stringify(imageData));
//       setVisibleImages(imageData);
//       setPage(1);
//       setGalleryReady(true);
//       return;
//     }
//     if (images && visibleImages && page && layoutHeight > 0 && !galleryReady) {
//       const position = parseInt(
//         sessionStorage.getItem("scrollPosition") || "0",
//         10
//       );
//       console.log("!images", images);
//       console.log("!visibleImages", visibleImages);
//       console.log("!page", page);
//       console.log("!galleryReady", galleryReady);
//       console.log("scrolling to", position);
//       window.scrollTo(0, position);
//       setTimeout(() => {
//         setGalleryReady(true);
//       }, 50);
//     }
//   }, [images, visibleImages, page, layoutHeight]);

//   // Track scroll position and layout height
//   useEffect(() => {
//     const handleScroll = () => {
//       const currentPosition = window.scrollY;
//       sessionStorage.setItem("scrollPosition", currentPosition.toString());
//       console.log("!currentPosition", currentPosition);
//       // Store the current layout height when user scrolls
//       if (galleryRef.current) {
//         const galleryHeight = galleryRef.current.scrollHeight;
//         sessionStorage.setItem("layoutHeight", galleryHeight.toString());
//         setLayoutHeight(galleryHeight);
//       }

//       const currentState = window.history.state || {};
//       window.history.replaceState(
//         { ...currentState, scrollPosition: currentPosition },
//         document.title
//       );
//     };
//     console.log("!galleryReady", galleryReady);

//     if (galleryReady) {
//       console.log("!adding scroll event listener");
//       window.addEventListener("scroll", handleScroll);
//     }

//     return () => {
//       console.log("!removing scroll event listener");
//       window.removeEventListener("scroll", handleScroll);
//     };
//   }, [galleryReady]);

//   // Loading state with height placeholder
//   if (isLoading && visibleImages.length === 0) {
//     return (
//       <div className="p-4" ref={galleryRef}>
//         {/* Placeholder div with the saved height to maintain layout */}
//         {layoutHeight > 0 && (
//           <div
//             style={{
//               height: `${layoutHeight}px`,
//               position: "absolute",
//               width: "100%",
//               left: 0,
//               opacity: 0,
//               pointerEvents: "none",
//             }}
//             aria-hidden="true"
//           />
//         )}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           {[...Array(6)].map((_, i) => (
//             <div key={i} className="animate-pulse">
//               <div className="bg-gray-200 rounded-lg aspect-square"></div>
//               <div className="h-4 bg-gray-200 rounded w-3/4 mt-2"></div>
//             </div>
//           ))}
//         </div>
//       </div>
//     );
//   }

//   if (isError) {
//     return (
//       <div className="p-4" ref={galleryRef}>
//         {/* Placeholder for error state too */}
//         {layoutHeight > 0 && (
//           <div
//             style={{
//               height: `${layoutHeight}px`,
//               position: "absolute",
//               width: "100%",
//               left: 0,
//               opacity: 0,
//               pointerEvents: "none",
//             }}
//             aria-hidden="true"
//           />
//         )}
//         <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
//           <h3 className="text-red-800 font-medium">Error loading images</h3>
//           <p className="text-red-600 mt-1">{error.message}</p>
//           <button
//             onClick={() => refetch()}
//             className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
//           >
//             Try Again
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-4" ref={galleryRef}>
//       {/* Show the height placeholder until gallery is ready */}
//       {!galleryReady && layoutHeight > 0 && (
//         <div
//           style={{
//             height: `${layoutHeight}px`,
//             position: "absolute",
//             width: "100%",
//             left: 0,
//             opacity: 0,
//             pointerEvents: "none",
//           }}
//           aria-hidden="true"
//         />
//       )}
//       <div className="flex justify-between items-center mb-4">
//         <h2 className="text-2xl font-bold">Image Gallery</h2>
//         <button
//           onClick={() => refetch()}
//           className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
//         >
//           Refresh
//         </button>
//       </div>

//       <div>
//         {visibleImages.length > 0 && (
//           <Gallery photos={visibleImages} direction="column" />
//         )}

//         <div
//           ref={loaderRef}
//           className="w-full h-10 flex justify-center items-center mt-4"
//         >
//           {visibleImages.length < (images?.length || 0) && (
//             <span className="text-gray-500">Loading more...</span>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// // Create a wrapper component for Gallery that handles image loading events
// const GalleryWithScroll = ({ photos, onImagesLoaded }) => {
//   const [imagesLoaded, setImagesLoaded] = useState(false);

//   // useEffect(() => {
//   //   // Reset loaded state when photos change
//   //   setImagesLoaded(false);

//   //   // Check if all images are already cached by browser
//   //   const checkImagesLoaded = async () => {
//   //     if (photos.length === 0) return;

//   //     // Create a promise for each image to load
//   //     const imagePromises = photos.map((photo) => {
//   //       return new Promise((resolve) => {
//   //         const img = new Image();
//   //         img.onload = () => resolve(true);
//   //         img.onerror = () => resolve(false);
//   //         img.src = photo.src;
//   //       });
//   //     });

//   //     // Wait for all images to load or fail
//   //     await Promise.all(imagePromises);
//   //     setImagesLoaded(true);
//   //     onImagesLoaded();
//   //   };

//   //   checkImagesLoaded();
//   // }, [photos, onImagesLoaded]);

//   return (
//     <div>
//       <Gallery
//         photos={photos}
//         // Set a consistent targetRowHeight to help maintain layout consistency
//         direction="column"
//       />
//     </div>
//   );
// };

// // Root layout that contains the navigation
// function RootLayout() {
//   return (
//     <div className="max-w-4xl mx-auto p-4">
//       <h1 className="text-3xl font-bold mb-4">App</h1>
//       <nav className="mb-6">
//         <ul className="flex space-x-4">
//           <li>
//             <Link
//               to="/"
//               className="text-blue-600 hover:underline px-3 py-2"
//               activeProps={{ className: "font-bold" }}
//             >
//               Home
//             </Link>
//           </li>
//           <li>
//             <Link
//               to="/about"
//               className="text-blue-600 hover:underline px-3 py-2"
//               activeProps={{ className: "font-bold" }}
//             >
//               About
//             </Link>
//           </li>
//           <li>
//             <Link
//               to="/contact"
//               className="text-blue-600 hover:underline px-3 py-2"
//               activeProps={{ className: "font-bold" }}
//             >
//               Contact
//             </Link>
//           </li>
//           <li>
//             <Link
//               to="/gallery"
//               className="text-blue-600 hover:underline px-3 py-2"
//               activeProps={{ className: "font-bold" }}
//             >
//               Gallery
//             </Link>
//           </li>
//         </ul>
//       </nav>
//       <Outlet />
//     </div>
//   );
// }

// // Create routes
// const rootRoute = createRootRoute({
//   component: RootLayout,
// });

// const indexRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: "/gallery",
//   component: Home,
// });

// const aboutRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: "/about",
//   component: About,
// });
// //
// const contactRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: "/contact",
//   component: Contact,
// });

// const imageGalleryRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: "/",
//   component: ImageGallery,
// });

// // Create router with scroll restoration enabled
// const router = createRouter({
//   routeTree: rootRoute.addChildren([
//     indexRoute,
//     aboutRoute,
//     contactRoute,
//     imageGalleryRoute,
//   ]),
//   // Enable scroll restoration
//   scrollRestoration: true,
// });

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 5 * 60 * 1000, // 5 minutes as default stale time
//       cacheTime: 10 * 60 * 1000, // 10 minutes as default cache time
//       refetchOnWindowFocus: false,
//       refetchOnMount: false,
//     },
//   },
// });

// const persister = createSyncStoragePersister({
//   storage: window.localStorage,
//   key: "art-gallery-cache", // unique key for localStorage
//   throttleTime: 1000, // don't write to localStorage more than once per second
// });

// function App() {
//   return (
//     <PersistQueryClientProvider
//       client={queryClient}
//       persistOptions={{ persister }}
//     >
//       <SharedStateProvider>
//         <RouterProvider router={router} />
//       </SharedStateProvider>
//     </PersistQueryClientProvider>
//   );
// }

// export default App;
