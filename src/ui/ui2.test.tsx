// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Breadcrumb,
  CircularProgress,
  ColorPicker,
  FloatingToolbar,
  LinearProgress,
  LoadingIndicator,
  SideSheet,
  SplitButton,
  Surface,
  TextField,
} from "./index";

afterEach(cleanup);

describe("Surface", () => {
  it("tonal has no glass class, glass has", () => {
    const { rerender } = render(<Surface data-testid="s" material="tonal" />);
    const tonal = screen.getByTestId("s").className;
    rerender(<Surface data-testid="s" material="glass" />);
    expect(screen.getByTestId("s").className).not.toBe(tonal);
  });
});

describe("FloatingToolbar", () => {
  function Toolbar() {
    const [open, setOpen] = useState(false);
    return (
      <FloatingToolbar label="Tools" open={open} onOpenChange={setOpen} logo={<span />}>
        <button>Pen</button>
      </FloatingToolbar>
    );
  }

  it("is a named toolbar whose buttons can't be reached while closed", () => {
    render(<Toolbar />);
    expect(screen.getByRole("toolbar", { name: "Tools" })).toBeTruthy();
    const logo = screen.getByRole("button", { name: "Open tools" });
    expect(logo.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Pen").closest("[inert]")).toBeTruthy();
  });

  it("opens from the logo", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Open tools" }));
    expect(screen.getByRole("button", { name: "Close tools" })).toBeTruthy();
    expect(screen.getByText("Pen").closest("[inert]")).toBeNull();
  });
});

describe("Progress", () => {
  it("linear reports its value", () => {
    render(<LinearProgress label="Importing" value={0.42} />);
    expect(
      screen.getByRole("progressbar", { name: "Importing" }).getAttribute("aria-valuenow"),
    ).toBe("42");
  });

  it("unknown length has no value", () => {
    render(<CircularProgress label="Loading" />);
    expect(
      screen.getByRole("progressbar", { name: "Loading" }).getAttribute("aria-valuenow"),
    ).toBeNull();
  });

  it("never reports more than 100%", () => {
    render(<LinearProgress label="Over" value={1.5} wavy={false} />);
    expect(screen.getByRole("progressbar", { name: "Over" }).getAttribute("aria-valuenow")).toBe(
      "100",
    );
  });

  it("loading indicator is named", () => {
    render(<LoadingIndicator label="Opening deck" />);
    expect(screen.getByRole("progressbar", { name: "Opening deck" })).toBeTruthy();
  });
});

describe("TextField", () => {
  it("links the label and shows errors", () => {
    render(<TextField label="Heading" value="" onChange={() => {}} error="Too long" />);
    const input = screen.getByRole("textbox", { name: "Heading" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Too long",
    );
  });

  it("reports typed text", () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Hi" } });
    expect(onChange).toHaveBeenCalledWith("Hi");
  });
});

describe("Breadcrumb", () => {
  it("makes earlier levels clickable and marks the current one", () => {
    const up = vi.fn();
    render(
      <Breadcrumb
        label="Selection"
        items={[
          { id: "s", label: "Slide 2", onClick: up },
          { id: "c", label: "Card" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Slide 2" }));
    expect(up).toHaveBeenCalledOnce();
    expect(screen.getByText("Card").getAttribute("aria-current")).toBe("location");
  });
});

describe("SplitButton", () => {
  it("runs the main action, and the arrow opens the menu", async () => {
    const save = vi.fn();
    const saveAs = vi.fn();
    render(
      <SplitButton
        label="Save"
        onClick={save}
        menuLabel="More save options"
        items={[{ label: "Save as", onSelect: saveAs }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "More save options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save as" }));
    expect(saveAs).toHaveBeenCalledOnce();
  });
});

describe("SideSheet", () => {
  it("closes with its button and with Escape", () => {
    const onClose = vi.fn();
    render(
      <SideSheet open onClose={onClose} title="Inspector">
        <p>Body</p>
      </SideSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Inspector" }));
    fireEvent.keyDown(screen.getByRole("complementary", { name: "Inspector" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("ColorPicker", () => {
  function Picker({ onSave }: { onSave?: (hex: string) => void }) {
    const [c, setC] = useState("#e5352b");
    return (
      <>
        <ColorPicker value={c} onChange={setC} onSave={onSave} />
        <output>{c}</output>
      </>
    );
  }

  it("applies a typed hex and rejects a bad one", () => {
    render(<Picker />);
    const hex = screen.getByRole("textbox", { name: "Hex color" });
    fireEvent.change(hex, { target: { value: "#1f6fe5" } });
    expect(screen.getByRole("status").textContent).toBe("#1f6fe5");
    fireEvent.change(hex, { target: { value: "#12" } });
    expect(screen.getByRole("status").textContent).toBe("#1f6fe5");
    expect(hex.getAttribute("aria-invalid")).toBe("true");
  });

  it("moves with the arrow keys and the hue slider", () => {
    render(<Picker />);
    const before = screen.getByRole("status").textContent;
    fireEvent.keyDown(screen.getByRole("slider", { name: "Saturation and brightness" }), {
      key: "ArrowLeft",
      shiftKey: true,
    });
    expect(screen.getByRole("status").textContent).not.toBe(before);
    fireEvent.change(screen.getByRole("slider", { name: "Hue" }), { target: { value: "200" } });
    expect(screen.getByRole("status").textContent).not.toBe(before);
  });

  it("saves to my colours", () => {
    const onSave = vi.fn();
    render(<Picker onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save to my colours" }));
    expect(onSave).toHaveBeenCalledWith("#e5352b");
  });
});
