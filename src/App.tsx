import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MotionConfig } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useApp } from "./appStore";
import { DeckView } from "./features/deck/DeckView";
import { RecoveryPrompt } from "./features/deck/RecoveryPrompt";
import { useFileOpening } from "./features/deck/useFileOpening";
import { NoticeLayer } from "./features/notices/NoticeLayer";
import { FadeThrough } from "./ui";
import { Home } from "./features/library/Home";
import { ShowLaunch } from "./features/library/ShowLaunch";
import { OfficeView } from "./features/office/OfficeView";
import { useSettings } from "./features/settings/settingsStore";

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
  const office = useApp((s) => s.office);
  const startSlide = useApp((s) => s.startSlide);
  const presentOnOpen = useApp((s) => s.presentOnOpen);
  const loadLibrary = useApp((s) => s.loadLibrary);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  // Waits for the library, and gives way to a file Windows asked to open.
  const libraryReady = useApp((s) => s.libraryReady);
  const startChecked = useRef(false);
  useEffect(() => {
    if (!libraryReady || startChecked.current) return;
    startChecked.current = true;
    const { deck: open, office: openOffice, opening, openLast } = useApp.getState();
    const lastFile = useSettings.getState().settings.startOn === "last";
    if (lastFile && !open && !openOffice && !opening) void openLast();
  }, [libraryReady]);

  // The real title bar follows the app's theme, not only Windows'.
  const theme = useSettings((s) => s.settings.theme);
  useEffect(() => {
    if (isTauri()) void getCurrentWindow().setTheme(theme === "system" ? null : theme);
  }, [theme]);

  // Browser reload keys would wipe the app's state, and an open presentation with it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (Gallery && galleryOpen) {
    return (
      <Suspense fallback={null}>
        <Gallery onClose={() => setGalleryOpen(false)} />
      </Suspense>
    );
  }
  return (
    <>
      {deck && !office ? (
        <DeckView key={deck.token} deck={deck} start={startSlide} presentOnOpen={presentOnOpen} />
      ) : (
        <FadeThrough id={office?.id ?? "home"} grow={!office} className="pw-screen">
          {office ? <OfficeView file={office} /> : <Home dragging={dragging} />}
        </FadeThrough>
      )}
      <RecoveryPrompt />
      <ShowLaunch />
    </>
  );
}

function App() {
  const reduceMotion = useSettings((s) => s.settings.reduceMotion);
  return (
    // Motion ignores the OS setting unless told otherwise.
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <Screens />
      <NoticeLayer />
    </MotionConfig>
  );
}

export default App;
