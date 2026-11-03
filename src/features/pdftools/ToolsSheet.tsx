import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  IconButton,
  LinearProgress,
  List,
  ListIcon,
  ListItem,
  SearchBar,
  SharedAxis,
  SideSheet,
} from "../../ui";
import { notify } from "../notices/notices";
import type { Change } from "./compare";
import { ToolFields } from "./ToolFields";
import { ALL_TOOLS } from "./registry";
import { GROUPS, type Tool, type ToolHost, type Values } from "./types";
import styles from "./PdfTools.module.css";

/** The ⋮ in the PDF's bar: every tool, by kind, with search, and each tool's options in place. */
export function ToolsSheet({
  open,
  hidden,
  host,
  onClose,
}: {
  open: boolean;
  /** Out of the way while a tool has the person place things on the pages. */
  hidden: boolean;
  host: ToolHost | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
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

  const choose = async (t: Tool) => {
    if (!host) return;
    setTool(t);
    setChanges(null);
    setError(null);
    const defaults = typeof t.defaults === "function" ? await t.defaults(host) : (t.defaults ?? {});
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
        width={380}
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
              <SearchBar
                label="Find a tool"
                placeholder="Find a tool"
                value={query}
                onChange={setQuery}
                material="tonal"
              />
              {GROUPS.map((g) => {
                const tools = found.filter((t) => t.group === g.id);
                if (!tools.length) return null;
                return (
                  <section key={g.id} className={styles.group}>
                    <h3 className={styles.groupTitle}>{g.title}</h3>
                    <List label={g.title}>
                      {tools.map((t) => (
                        <ListItem
                          key={t.id}
                          headline={t.title}
                          supporting={t.blurb}
                          leading={<ListIcon icon={t.icon} />}
                          onClick={() => void choose(t)}
                        />
                      ))}
                    </List>
                  </section>
                );
              })}
              {found.length === 0 && <p className={styles.note}>No tool by that name.</p>}
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
