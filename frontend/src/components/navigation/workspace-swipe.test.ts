import { describe, expect, it } from "vitest";
import {
  clampWorkspaceOffset,
  getWorkspaceRouteIndex,
  resolveGestureAxis,
  resolveWorkspaceSwipe
} from "./workspace-swipe";

describe("workspace swipe utilities", () => {
  it("maps primary workspace routes in order", () => {
    expect(getWorkspaceRouteIndex("/")).toBe(0);
    expect(getWorkspaceRouteIndex("/calendar")).toBe(1);
    expect(getWorkspaceRouteIndex("/statistics")).toBe(2);
    expect(getWorkspaceRouteIndex("/profile")).toBe(-1);
  });

  it("locks to vertical movement when vertical motion dominates", () => {
    expect(resolveGestureAxis(18, 80)).toBe("vertical");
  });

  it("locks to horizontal movement when horizontal motion dominates", () => {
    expect(resolveGestureAxis(-80, 18)).toBe("horizontal");
  });

  it("keeps small diagonal movement undecided", () => {
    expect(resolveGestureAxis(8, 7)).toBe("undecided");
  });

  it("prevents dragging beyond boundary tabs", () => {
    expect(clampWorkspaceOffset(120, 0)).toBe(0);
    expect(clampWorkspaceOffset(-120, 2)).toBe(0);
    expect(clampWorkspaceOffset(-120, 0)).toBe(-120);
  });

  it("navigates after a deliberate half-screen swipe", () => {
    expect(
      resolveWorkspaceSwipe({
        offsetX: -180,
        offsetY: 12,
        velocityX: -120,
        viewportWidth: 390,
        currentIndex: 0
      })
    ).toMatchObject({ shouldNavigate: true, targetIndex: 1 });
  });

  it("snaps back under the distance threshold", () => {
    expect(
      resolveWorkspaceSwipe({
        offsetX: -80,
        offsetY: 10,
        velocityX: -120,
        viewportWidth: 390,
        currentIndex: 0
      })
    ).toMatchObject({ shouldNavigate: false, targetIndex: 0 });
  });

  it("allows a confident flick with a minimum distance", () => {
    expect(
      resolveWorkspaceSwipe({
        offsetX: -72,
        offsetY: 8,
        velocityX: -1100,
        viewportWidth: 390,
        currentIndex: 1
      })
    ).toMatchObject({ shouldNavigate: true, targetIndex: 2 });
  });

  it("does not navigate from vertical scrolling", () => {
    expect(
      resolveWorkspaceSwipe({
        offsetX: -220,
        offsetY: 260,
        velocityX: -1200,
        viewportWidth: 390,
        currentIndex: 1
      })
    ).toMatchObject({ axis: "vertical", shouldNavigate: false, targetIndex: 1 });
  });
});
