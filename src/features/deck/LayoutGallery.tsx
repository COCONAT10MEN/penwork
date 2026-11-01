import { SLIDE_LAYOUTS, type SlideLayout } from "../../lib/deck/layouts";
import { Button, Dialog, Icon } from "../../ui";
import styles from "./DeckView.module.css";

export function LayoutGallery({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (layout: SlideLayout) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      headline="Add a slide"
      icon="add"
      material="glass"
      actions={
        <Button variant="text" size="medium" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className={styles.layouts}>
        {SLIDE_LAYOUTS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`pw-state pw-press ${styles.layout}`}
            onClick={() => {
              onClose();
              onPick(id);
            }}
          >
            <Icon name={icon} size={32} />
            {label}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
