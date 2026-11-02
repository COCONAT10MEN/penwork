import { Button, Switch } from "../../../ui";
import { Group, Hint, type Editing } from "./fields";
import styles from "./Inspector.module.css";

const MOST_ROWS = 6;
const MOST_COLUMNS = 5;

function rowsOf(table: Element): Element[] {
  return Array.from(table.querySelectorAll("tr"));
}

function addRow(table: Element): void {
  const last = rowsOf(table).at(-1);
  if (!last) return;
  const row = last.cloneNode(true) as Element;
  for (const cell of Array.from(row.children)) cell.textContent = "—";
  last.parentElement?.appendChild(row);
}

function addColumn(table: Element): void {
  for (const row of rowsOf(table)) {
    const last = row.lastElementChild;
    if (!last) continue;
    const cell = last.cloneNode(false) as Element;
    cell.textContent = "—";
    row.appendChild(cell);
  }
}

export function TableFields({ edit }: { edit: Editing }) {
  const rows = rowsOf(edit.element);
  const columns = rows[0]?.children.length ?? 0;
  const big = rows.length > MOST_ROWS || columns > MOST_COLUMNS;
  return (
    <>
      <Group title={`${rows.length} rows, ${columns} columns`}>
        <div className={styles.buttons}>
          <Button variant="tonal" size="small" icon="add" onClick={() => edit.change(addRow)}>
            Row
          </Button>
          <Button
            variant="text"
            size="small"
            disabled={rows.length < 2}
            onClick={() => edit.change((t) => rowsOf(t).at(-1)?.remove())}
          >
            Remove row
          </Button>
        </div>
        <div className={styles.buttons}>
          <Button variant="tonal" size="small" icon="add" onClick={() => edit.change(addColumn)}>
            Column
          </Button>
          <Button
            variant="text"
            size="small"
            disabled={columns < 2}
            onClick={() =>
              edit.change((t) => {
                for (const row of rowsOf(t)) row.lastElementChild?.remove();
              })
            }
          >
            Remove column
          </Button>
        </div>
        {big && <Hint>Tables bigger than 6 rows by 5 columns may not fit on the slide.</Hint>}
      </Group>
      <Switch
        label="Tight rows"
        checked={edit.element.classList.contains("tight")}
        onCheckedChange={(on) => edit.change((t) => t.classList.toggle("tight", on))}
      />
      <Hint>Double-click a cell on the slide to change its text.</Hint>
    </>
  );
}
