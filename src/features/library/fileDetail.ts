import { slidesLabel, whenOpened } from "./greeting";
import { KIND_NAMES, type LibraryFile } from "./libraryFiles";
import { matchSnippet } from "./librarySearch";

export function fileDetail(file: LibraryFile, query = ""): string {
  if (file.missing) return "File not found";
  const when = whenOpened(file.lastOpened, new Date());
  if (file.deck) {
    return matchSnippet(file.deck, query) ?? `${slidesLabel(file.deck.slides)} · ${when}`;
  }
  return `${KIND_NAMES[file.kind]} · ${when}`;
}
