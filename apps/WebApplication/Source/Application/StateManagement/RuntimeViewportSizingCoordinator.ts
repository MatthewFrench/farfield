import { z } from "zod";

const MINIMUM_VIEWPORT_HEIGHT_PX = 1;

export type ViewportOrientation = "portrait" | "landscape";

export interface RuntimeViewportMetrics {
  orientation: ViewportOrientation;
  appHeight: number;
  visualViewportHeight: number;
  layoutViewportHeight: number;
  keyboardDelta: number;
  keyboardOpen: boolean;
  safeAreaInsetBottom: number;
}

export class RuntimeViewportSizingCoordinator {
  private maxVisualHeightPortrait: number;
  private maxVisualHeightLandscape: number;
  private readonly keyboardOpenDeltaThresholdPx: number;
  private readonly positiveFiniteNumberSchema: z.ZodNumber;

  public constructor(keyboardOpenDeltaThresholdPx: number) {
    this.keyboardOpenDeltaThresholdPx = z
      .number()
      .finite()
      .nonnegative()
      .parse(keyboardOpenDeltaThresholdPx);
    this.maxVisualHeightPortrait = 0;
    this.maxVisualHeightLandscape = 0;
    this.positiveFiniteNumberSchema = z.number().finite().positive();
  }

  public readSafeAreaInsetLeftPx(): number {
    return this.readCssPixelVariable("--safe-area-inset-left");
  }

  public applyViewportSizingVariables(): RuntimeViewportMetrics {
    const root = document.documentElement;
    const layoutViewportHeight = window.innerHeight;
    const visualViewportHeight = this.readVisualViewportHeightPx();
    const orientation = this.readViewportOrientation();

    // Keep a per-orientation baseline so keyboard detection remains stable across rotations.
    if (orientation === "landscape") {
      this.maxVisualHeightLandscape = Math.max(this.maxVisualHeightLandscape, visualViewportHeight);
    } else {
      this.maxVisualHeightPortrait = Math.max(this.maxVisualHeightPortrait, visualViewportHeight);
    }

    const baselineHeight =
      orientation === "landscape" ? this.maxVisualHeightLandscape : this.maxVisualHeightPortrait;
    const keyboardDelta = Math.max(0, baselineHeight - visualViewportHeight);
    const keyboardOpen = keyboardDelta >= this.keyboardOpenDeltaThresholdPx;
    const safeAreaInsetBottom = this.readCssPixelVariable("--safe-area-inset-bottom-clamped");
    const composerSafeBottomInset = keyboardOpen ? 0 : safeAreaInsetBottom;
    const appHeight = Math.max(MINIMUM_VIEWPORT_HEIGHT_PX, Math.round(visualViewportHeight));

    root.style.setProperty("--app-height", `${String(appHeight)}px`);
    root.style.setProperty(
      "--composer-safe-bottom-inset",
      `${String(Math.max(0, Math.round(composerSafeBottomInset)))}px`,
    );

    return {
      orientation,
      appHeight,
      visualViewportHeight,
      layoutViewportHeight,
      keyboardDelta,
      keyboardOpen,
      safeAreaInsetBottom,
    };
  }

  public clearViewportSizingVariables(): void {
    document.documentElement.style.removeProperty("--app-height");
    document.documentElement.style.removeProperty("--composer-safe-bottom-inset");
  }

  private readCssPixelVariable(variableName: string): number {
    const raw = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
    if (raw.length === 0) {
      return 0;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private readViewportOrientation(): ViewportOrientation {
    return window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
  }

  private readVisualViewportHeightPx(): number {
    const visualViewportHeightResult = this.positiveFiniteNumberSchema.safeParse(
      window.visualViewport?.height,
    );
    if (visualViewportHeightResult.success) {
      return visualViewportHeightResult.data;
    }
    const innerHeightResult = this.positiveFiniteNumberSchema.safeParse(window.innerHeight);
    if (innerHeightResult.success) {
      return innerHeightResult.data;
    }
    return MINIMUM_VIEWPORT_HEIGHT_PX;
  }
}
