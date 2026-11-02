import type { RefObject } from "react";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import type { SlideMenuTarget } from "./SlideMenu";
import type { KeyPress } from "./useEditKeys";
import type { useSlideEditing } from "./useSlideEditing";

/** What the slide list on the left says it did. */
export function useSlideListEvents({
  box,
  slideCount,
  editing,
  setSelected,
  setMenu,
  onKey,
  onScrolled,
  onReady,
}: {
  box: RefObject<HTMLDivElement | null>;
  slideCount: number;
  editing: ReturnType<typeof useSlideEditing>;
  setSelected: ReturnType<typeof useSlideEditing>["setSelected"];
  setMenu: (menu: SlideMenuTarget | null) => void;
  onKey: (press: KeyPress) => void;
  onScrolled: (down: boolean) => void;
  onReady: () => void;
}) {
  const onSlide = (message: RuntimeMessage) => {
    if (message.type === "pick") {
      setMenu(null);
      editing.pick(message.slide, message);
    } else if (message.type === "move") {
      if (message.to >= 0 && message.to <= slideCount) editing.move(message.slide, message.to);
    } else if (message.type === "menu") {
      const frame = box.current?.getBoundingClientRect();
      setSelected((now) => (now.includes(message.slide) ? now : [message.slide]));
      setMenu({
        slide: message.slide,
        x: (frame?.left ?? 0) + message.x,
        y: (frame?.top ?? 0) + message.y,
      });
    }
  };

  return (message: RuntimeMessage) => {
    if (message.type === "ready") onReady();
    else if (message.type === "key") onKey(message);
    else if (message.type === "scrolled") onScrolled(message.down);
    else if (message.type === "pick" || message.type === "menu" || message.type === "move") {
      if (message.slide >= 0 && message.slide < slideCount) onSlide(message);
    }
  };
}
