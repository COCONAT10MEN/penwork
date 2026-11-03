import { useState } from "react";
import { Button, Dialog, TextField } from "../../ui";
import { usePrompt } from "./passwordAsk";

/** Asks for a PDF's password, in our own dialog. */

export function PasswordPrompt() {
  const ask = usePrompt((s) => s.ask);
  const [value, setValue] = useState("");
  const done = (password: string | null) => {
    ask?.answer(password);
    usePrompt.setState({ ask: null });
    setValue("");
  };
  return (
    <Dialog
      open={ask !== null}
      onClose={() => done(null)}
      headline="This PDF has a password"
      icon="lock"
      material="glass"
      actions={
        <>
          <Button variant="text" size="medium" onClick={() => done(null)}>
            Cancel
          </Button>
          <Button size="medium" disabled={!value} onClick={() => done(value)}>
            Open
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) done(value);
        }}
      >
        <TextField
          label="Password"
          type="password"
          autoFocus
          value={value}
          onChange={setValue}
          supporting={ask ? `For "${ask.name}". It's kept when you save.` : undefined}
          error={ask?.wrong ? "That's not the password. Try again." : undefined}
        />
      </form>
    </Dialog>
  );
}
