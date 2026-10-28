import { lazy, Suspense, useEffect, useState } from "react";
import { Button, SnackbarProvider } from "./ui";
import "./App.css";

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

// Placeholder until the Library screen (M2).
function App() {
  const [galleryOpen, setGalleryOpen] = useGalleryToggle();

  return (
    <SnackbarProvider>
      {Gallery && galleryOpen ? (
        <Suspense fallback={null}>
          <Gallery onClose={() => setGalleryOpen(false)} />
        </Suspense>
      ) : (
        <main className="app">
          <span className="material-symbols-rounded app__icon" aria-hidden="true">
            edit_note
          </span>
          <h1 className="app__title">Penwork</h1>
          <p className="app__tagline">Your PDFs and notes, in one place</p>
          {Gallery && (
            <Button variant="tonal" icon="palette" onClick={() => setGalleryOpen(true)}>
              Component gallery (Ctrl+Shift+G)
            </Button>
          )}
        </main>
      )}
    </SnackbarProvider>
  );
}

export default App;
