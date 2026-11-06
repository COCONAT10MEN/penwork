import { createContext } from "react";

/** True inside a panel that is glass already, where a section is a heading and its rows. */
export const FlatSections = createContext(false);

type ToolbarListener = (settings: Record<string, unknown>) => void;

/** Told of every change to the annotation toolbar's settings, to pass them to an open toolbar. */
export const ToolbarLive = createContext<ToolbarListener | null>(null);
