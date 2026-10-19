import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AUDIT_HISTORY_EMPTY, AUDIT_HISTORY_TITLE, AuditHistory } from "@/components/admin/AuditHistory";
import { AUDIT_PANEL_SIZE, type AuditEntryView } from "@/lib/admin/audit";

const entry = (i: number): AuditEntryView => ({
  id: `a${i}`,
  action: "product.update",
  actorId: "u1",
  actorEmail: "admin@example.com",
  entityType: "product",
  entityId: "7",
  changes: { stock: [i, i + 1] },
  ip: null,
  at: new Date(Date.UTC(2026, 9, 18, 12, i)).toISOString(),
});

describe("AuditHistory", () => {
  it("shows the latest entries only, says older ones exist, and links to the whole log", () => {
    // listAuditEntries reads one more than the panel shows.
    render(<AuditHistory entries={Array.from({ length: AUDIT_PANEL_SIZE + 1 }, (_, i) => entry(i))} entity={{ type: "product", id: "7" }} />);
    expect(screen.getByRole("heading", { name: AUDIT_HISTORY_TITLE })).toBeInTheDocument();
    expect(within(screen.getByTestId("audit-history")).getAllByRole("listitem")).toHaveLength(AUDIT_PANEL_SIZE);
    expect(screen.getByTestId("audit-history-more")).toHaveTextContent(`los ${AUDIT_PANEL_SIZE} cambios más recientes`);
    expect(screen.getByRole("link", { name: /^Ver todo/ })).toHaveAttribute("href", "/admin/audit?entity=product&entityId=7");
  });

  it("says nothing about older entries when every one fits, and has one empty text", () => {
    const { unmount } = render(<AuditHistory entries={[entry(1)]} entity={{ type: "product", id: "7" }} />);
    expect(screen.queryByTestId("audit-history-more")).not.toBeInTheDocument();
    unmount();
    render(<AuditHistory entries={[]} entity={{ type: "theme", id: "t1" }} />);
    expect(screen.getByText(AUDIT_HISTORY_EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
