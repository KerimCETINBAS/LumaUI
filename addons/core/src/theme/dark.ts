import { IconTextures } from "./icons";

/** Shared design tokens for LumaUI's dark appearance. */
export const darkTheme = {
    colors: {
        background: { r: 0.035, g: 0.045, b: 0.065, a: 0.9 },
        surface: { r: 0.08, g: 0.1, b: 0.14, a: 0.75 },
        border: { r: 0.22, g: 0.28, b: 0.36, a: 0.8 },
        text: { r: 0.78, g: 0.83, b: 0.9, a: 1 },
        muted: { r: 0.35, g: 0.38, b: 0.44, a: 1 },
        accent: { r: 0.4, g: 0.75, b: 1, a: 1 },
    },
    spacing: { panelPadding: 6 },
    icons: IconTextures,
} as const;
