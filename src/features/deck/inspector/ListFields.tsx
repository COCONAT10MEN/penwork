import { Button } from "../../../ui";
import { CommitField, Group, Hint, RowTools, type Editing } from "./fields";
import styles from "./Inspector.module.css";

function move(list: Element, at: number, by: number): void {
  const items = Array.from(list.children);
  const item = items[at];
  const other = items[at + by];
  if (!item || !other) return;
  if (by < 0) list.insertBefore(item, other);
  else list.insertBefore(other, item);
}

/** The items of a list: words, order, adding and taking out. */
function Items({
  edit,
  root,
  name,
  blank,
}: {
  edit: Editing;
  /** Finds the list in the element, in the copy being read and the one being changed. */
  root: (element: Element) => Element | null;
  name: string;
  blank: (list: Element) => Element;
}) {
  const list = root(edit.element);
  if (!list) return null;
  const items = Array.from(list.children);
  const change = (how: (target: Element) => void) =>
    edit.change((el) => {
      const target = root(el);
      if (target) how(target);
    });
  return (
    <Group title={`${name}s`}>
      {items.map((item, at) => (
        <div key={at} className={styles.row}>
          {item.children.length === 0 ? (
            <CommitField
              label={`${name} ${at + 1}`}
              value={item.textContent ?? ""}
              onCommit={(value) =>
                change((target) => {
                  const it = target.children[at];
                  if (it) it.textContent = value;
                })
              }
            />
          ) : (
            <Hint>
              {name} {at + 1}: {(item.textContent ?? "").slice(0, 34)}
            </Hint>
          )}
          <RowTools
            label={`${name.toLowerCase()} ${at + 1}`}
            onUp={at > 0 ? () => change((t) => move(t, at, -1)) : undefined}
            onDown={at < items.length - 1 ? () => change((t) => move(t, at, 1)) : undefined}
            onRemove={items.length > 1 ? () => change((t) => t.children[at]?.remove()) : undefined}
          />
        </div>
      ))}
      <Button
        variant="tonal"
        size="small"
        icon="add"
        onClick={() => change((t) => t.appendChild(blank(t)))}
      >
        Add {name.toLowerCase()}
      </Button>
    </Group>
  );
}

export function CardList({ edit }: { edit: Editing }) {
  return (
    <Items
      edit={edit}
      name="Item"
      root={(el) => el}
      blank={(list) => {
        const li = list.ownerDocument.createElement("li");
        li.textContent = "New item";
        return li;
      }}
    />
  );
}

/** The contents chips on a cover. */
export function ChipList({ edit }: { edit: Editing }) {
  return (
    <Items
      edit={edit}
      name="Chip"
      root={(el) => el}
      blank={(list) => {
        const chip = list.ownerDocument.createElement("div");
        chip.className = "c";
        const number = list.ownerDocument.createElement("i");
        number.textContent = String(list.children.length + 1);
        chip.append(number, "New section");
        return chip;
      }}
    />
  );
}
