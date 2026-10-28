// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ButtonGroup,
  Chip,
  FabMenu,
  IconButton,
  Menu,
  NavigationRail,
  SearchBar,
  Slider,
  Switch,
} from "./index";

afterEach(cleanup);

describe("IconButton", () => {
  it("uses the label as its accessible name", () => {
    render(<IconButton icon="search" label="Search" />);
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("is a toggle with aria-pressed when selected is given", () => {
    render(<IconButton icon="star" label="Favorite" selected={false} />);
    expect(screen.getByRole("button", { name: "Favorite" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});

describe("ButtonGroup", () => {
  const options = [
    { value: "grid", label: "Grid" },
    { value: "list", label: "List" },
  ];

  it("single-select is a radio group with arrow keys and one Tab stop", () => {
    const onChange = vi.fn();
    render(<ButtonGroup label="View" value="grid" onChange={onChange} options={options} />);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeTruthy();
    const grid = screen.getByRole("radio", { name: "Grid" });
    expect(grid.getAttribute("aria-checked")).toBe("true");
    expect(grid.tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "List" }).tabIndex).toBe(-1);
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("multi-select is toggle buttons", () => {
    const onChange = vi.fn();
    render(<ButtonGroup label="View" value={["grid"]} onChange={onChange} options={options} />);
    expect(screen.getByRole("button", { name: "Grid" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(onChange).toHaveBeenCalledWith(["grid", "list"]);
  });
});

describe("Chip", () => {
  it("filter chips expose their state", () => {
    render(<Chip variant="filter" label="PDFs" selected />);
    expect(screen.getByRole("button", { name: "PDFs" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Switch", () => {
  function Controlled() {
    const [on, setOn] = useState(false);
    return <Switch label="Dark pages" checked={on} onCheckedChange={setOn} />;
  }

  it("is a labelled switch that toggles", () => {
    render(<Controlled />);
    const sw = screen.getByRole("switch", { name: "Dark pages" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });
});

describe("Slider", () => {
  it("is a labelled range with a readable value", () => {
    render(
      <Slider
        label="Thickness"
        value={4}
        min={1}
        max={12}
        format={(v) => `${v} pt`}
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole("slider", { name: "Thickness" });
    expect(input.getAttribute("aria-valuetext")).toBe("4 pt");
  });
});

describe("SearchBar", () => {
  it("clears with Escape", () => {
    const onChange = vi.fn();
    render(<SearchBar label="Search notes" value="waves" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search notes" }), { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("NavigationRail", () => {
  it("names icon-only items and marks the current page", () => {
    render(
      <NavigationRail
        label="Main"
        expanded={false}
        value="pdfs"
        onChange={() => {}}
        items={[
          { id: "library", label: "Library", icon: "home" },
          { id: "pdfs", label: "PDFs", icon: "picture_as_pdf" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "PDFs" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("Menu", () => {
  function Harness({ onSelect }: { onSelect: () => void }) {
    const [open, setOpen] = useState(true);
    const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
    return (
      <>
        <button ref={setAnchor}>More</button>
        <Menu
          open={open && anchor !== null}
          anchor={anchor}
          label="More options"
          onClose={() => setOpen(false)}
          items={[
            { label: "Open", onSelect },
            { label: "Rename", onSelect, disabled: true },
            "divider",
            { label: "Remove", onSelect },
          ]}
        />
      </>
    );
  }

  it("focuses the first item, reaches disabled ones without running them, closes on Escape", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const menu = await screen.findByRole("menu", { name: "More options" });
    expect(document.activeElement?.textContent).toBe("Open");
    act(() => {
      fireEvent.keyDown(menu, { key: "ArrowDown" });
    });
    expect(document.activeElement?.textContent).toBe("Rename");
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onSelect).not.toHaveBeenCalled();
    act(() => {
      fireEvent.keyDown(menu, { key: "ArrowDown" });
    });
    expect(document.activeElement?.textContent).toBe("Remove");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(document.activeElement?.textContent).toBe("More");
  });
});

describe("FabMenu", () => {
  it("opens, and disabled actions do nothing", async () => {
    const importPdf = vi.fn();
    const newNotebook = vi.fn();
    render(
      <FabMenu
        label="Create"
        items={[
          { icon: "picture_as_pdf", label: "Import PDF", onSelect: importPdf },
          {
            icon: "book",
            label: "New notebook",
            onSelect: newNotebook,
            disabled: true,
            disabledReason: "Coming in a later update",
          },
        ]}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Create" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const disabled = await screen.findByRole("menuitem", { name: "New notebook" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(disabled);
    expect(newNotebook).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Import PDF" }));
    expect(importPdf).toHaveBeenCalledOnce();
  });
});
