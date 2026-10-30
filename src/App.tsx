import { MotionConfig } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useApp } from "./appStore";
import { PlaceholderViewer } from "./features/deck/PlaceholderViewer";
import { useFileOpening } from "./features/deck/useFileOpening";
import { Home } from "./features/library/Home";
import { SnackbarProvider } from "./ui";

// Dev builds only: the import is behind import.meta.env.DEV, so release builds drop the Gallery.
const Gallery = import.meta.env.DEV ? lazy(() => import("./features/gallery/Gallery")) : null;

function useGalleryToggle(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => Gallery !== null && location.hash === "#gallery");
  useEffect(() => {
    if (!Gallery) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return [open, setOpen];
}

function Screens() {
  const dragging = useFileOpening();
  const [galleryOpen, setGalleryOpen] = useGalleryToggle();
  const deck = useApp((s) => s.deck);
  const startSlide = useApp((s) => s.startSlide);
  const loadLibrary = useApp((s) => s.loadLibrary);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  if (Gallery && galleryOpen) {
    return (
      <Suspense fallback={null}>
        <Gallery onClose={() => setGalleryOpen(false)} />
      </Suspense>
    );
  }
  return deck ? (
    <PlaceholderViewer key={deck.token} deck={deck} start={startSlide} />
  ) : (
    <Home dragging={dragging} />
  );
}

function App() {
  return (
    // Motion ignores the OS setting unless told otherwise. Settings will switch this to "always".
    <MotionConfig reducedMotion="user">
      <SnackbarProvider>
        <Screens />
      </SnackbarProvider>
    </MotionConfig>
  );
}

export default App;
