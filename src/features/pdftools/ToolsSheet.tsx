import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Icon,
  IconButton,
  LinearProgress,
  SearchBar,
  FadeThrough,
  NavigationRail,
  SharedAxis,
  SideSheet,
} from "../../ui";
import { notify } from "../notices/notices";
import type { Change } from "./compare";
import { ToolFields } from "./ToolFields";
import { PdfSettingsPane } from "./PdfSettingsPane";
import { ShapeGrid, ToolGrid } from "./ToolGrid";
import { ALL_TOOLS } from "./registry";
import { GROUPS, type GroupId, type Tool, type ToolHost, type Values } from "./types";

import styles from "./PdfTools.module.css";

/** The ⋮ in the PDF's bar: every tool, by kind, with search, and each tool's options in place. */
export function ToolsSheet({
  open,
  hidden,
  host,
  editing,
  onEditing,
  onClose,
}: {
  open: boolean;
  /** Settings ▸ Editing. Off, the Edit and Shapes tools are put away; the rest stay. */
  editing: boolean;
  onEditing: () => void;
  /** Out of the way while a tool has the person place things on the pages. */
  hidden: boolean;
  host: ToolHost | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  // Kept between openings: the tab used last is where the next look starts.
  const [tab, setTab] = useState<GroupId | "settings">("pages");
  const [tool, setTool] = useState<Tool | null>(null);
  const [values, setValues] = useState<Values>({});
  const [running, setRunning] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Closing goes back to the list for next time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setTool(null);
      setQuery("");
    }
  }

  const found = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return ALL_TOOLS.filter(
      (t) =>
        (!t.when || (host && t.when(host))) &&
        words.every((w) => `${t.title} ${t.blurb} ${t.keywords ?? ""}`.toLowerCase().includes(w)),
    );
  }, [query, host]);

  const run = async (t: Tool, v: Values) => {
    if (!host || running) return;
    setError(null);
    setRunning([0, 0]);
    try {
      const result = await t.run(
        host,
        v,
        (done, total) => live.current && setRunning([done, total]),
      );
      if (Array.isArray(result)) {
        setChanges(result);
      } else {
        if (typeof result === "string") notify(result, "info");
        onClose();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message === "PASSWORD" ? "That PDF needs its password first." : message);
    } finally {
      if (live.current) setRunning(null);
    }
  };

  /** `preset` starts some options chosen already: the shape picked on the Shapes tab. */
  const choose = async (t: Tool, preset: Values = {}) => {
    if (!host) return;
    // Found by search while editing is off: its tab says so, with the way to turn it on.
    if (!editing && EDITS.includes(t.group)) {
      setQuery("");
      setTab(t.group);
      return;
    }
    setTool(t);
    setChanges(null);
    setError(null);
    const defaults = {
      ...(typeof t.defaults === "function" ? await t.defaults(host) : (t.defaults ?? {})),
      ...preset,
    };
    setValues(defaults);
    if (t.instant) void run(t, defaults);
  };

  const pct = running && running[1] ? running[0] / running[1] : undefined;

  return (
    <div className={styles.sheetPlace} data-hidden={hidden || undefined}>
      <SideSheet
        open={open}
        onClose={onClose}
        title={tool ? tool.title : "PDF tools"}
        width={540}
        material="glass"
        strength="thick"
        actions={
          tool && !running ? (
            <IconButton icon="arrow_back" label="All tools" onClick={() => setTool(null)} />
          ) : undefined
        }
      >
        <SharedAxis
          id={tool ? tool.id : "list"}
          order={["list", ...ALL_TOOLS.map((t) => t.id)]}
          label={tool?.title ?? "PDF tools"}
        >
          {!tool ? (
            <div className={styles.list}>
              {/* Every kind down the side, all in sight, with room for more. */}
              <NavigationRail
                label="Kinds of tools"
                layout="stacked"
                items={GROUPS.map((g) => ({ id: g.id, label: g.title, icon: g.icon }))}
                value={query.trim() ? "" : tab}
                onChange={(id) => {
                  setQuery("");
                  setTab(id as GroupId | "settings");
                }}
                footerItems={[{ id: "settings", label: "Settings", icon: "settings" }]}
              />
              <div className={styles.browseMain}>
                <SearchBar
                  label="Find a tool"
                  placeholder="Find a tool"
                  value={query}
                  onChange={setQuery}
                  material="tonal"
                />
                {/* Each side scrolls on its own: the rail, and what's beside it. */}
                <div className={styles.browseScroll} data-scroll>
                  {query.trim() ? (
                    found.length ? (
                      <ToolGrid tools={found} onPick={(t) => void choose(t)} />
                    ) : (
                      <p className={styles.note}>No tool by that name.</p>
                    )
                  ) : (
                    <FadeThrough id={tab}>
                      {!editing && EDITS.includes(tab as GroupId) ? (
                        <EditingOff onEditing={onEditing} />
                      ) : tab === "settings" ? (
                        host && <PdfSettingsPane toToolbar={host.toolbarChanged} />
                      ) : tab === "shapes" ? (
                        <ShapeGrid
                          onPick={(shape) => {
                            const t = ALL_TOOLS.find((x) => x.id === "shapes");
                            if (t) void choose(t, { shape });
                          }}
                        />
                      ) : (
                        <ToolGrid
                          tools={found.filter((t) => t.group === tab)}
                          onPick={(t) => void choose(t)}
                        />
                      )}
                    </FadeThrough>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.panel}>
              <p className={styles.blurb}>{tool.blurb}</p>
              {tool.fields && host && !changes && (
                <fieldset className={styles.fieldset} disabled={running !== null}>
                  <ToolFields
                    fields={tool.fields}
                    values={values}
                    host={host}
                    onChange={setValues}
                  />
                </fieldset>
              )}
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              {running && (
                <div className={styles.progress}>
                  <LinearProgress label={`${tool.title}: working`} value={pct} />
                  <span className={styles.count}>
                    {running[1] > 1
                      ? `${Math.min(running[0] + 1, running[1])} of ${running[1]}`
                      : "Working…"}
                  </span>
                </div>
              )}
              {changes && host && <ChangeList changes={changes} host={host} />}
              {!tool.instant && !changes && (
                <Button
                  size="medium"
                  icon={tool.icon}
                  disabled={running !== null}
                  onClick={() => void run(tool, values)}
                >
                  {tool.action ?? "Go"}
                </Button>
              )}
            </div>
          )}
        </SharedAxis>
      </SideSheet>
    </div>
  );
}

/** The kinds of tools that change what's on the pages, which need Settings ▸ Editing on. */
const EDITS: GroupId[] = ["edit", "shapes"];

function EditingOff({ onEditing }: { onEditing: () => void }) {
  return (
    <div className={styles.editingOff}>
      <Icon name="edit_off" size={32} className={styles.editingOffIcon} />
      <p className={styles.editingOffTitle}>Editing is off</p>
      <p className={styles.note}>
        These tools change what's on the pages, so they need editing on. It can also be turned on or
        off in Settings, under View.
      </p>
      <Button size="medium" icon="edit" onClick={onEditing}>
        Turn on editing
      </Button>
    </div>
  );
}

function ChangeList({ changes, host }: { changes: Change[]; host: ToolHost }) {
  if (!changes.length)
    return <p className={styles.note}>No differences in the text. The two read the same.</p>;
  return (
    <>
      <p className={styles.note}>
        {changes.length >= 1000
          ? "The first 1000 differences."
          : `${changes.length} ${changes.length === 1 ? "difference" : "differences"}.`}{" "}
        Pick one to go to its page.
      </p>
      <ul className={styles.changes}>
        {changes.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              className={`pw-state ${styles.change}`}
              onClick={() => host.goTo(c.page)}
            >
              <span className={styles.changeKind} data-kind={c.kind}>
                {c.kind === "added" ? "Added" : c.kind === "removed" ? "Only here" : "Changed"}
              </span>
              <span className={styles.changeText}>
                {c.here && <del>{c.here.slice(0, 160)}</del>}
                {c.there && <ins>{c.there.slice(0, 160)}</ins>}
              </span>
              <span className={styles.changePage}>Page {c.page}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
