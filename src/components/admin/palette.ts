/**
 * Admin palette — only the brand navy and copper, in tints and shades.
 * Copper marks what's achieved (signed); navy carries progress and structure.
 */
export const NAVY = {
  950: "#0B1626", 900: "#0F1E35", 800: "#142844", 700: "#1F3A5F", 600: "#2F4F7A",
  500: "#4A6A94", 400: "#7590B4", 300: "#A7B9D1", 200: "#CDD8E6", 100: "#E6ECF4", 50: "#F3F6FA",
} as const;

export const COPPER = {
  800: "#6E3A1C", 700: "#8C4B26", 600: "#A65B30", 500: "#B76A3B", 400: "#CB8A60",
  300: "#DDAE8E", 200: "#EBCDB8", 100: "#F5E6DB", 50: "#FAF3EE",
} as const;

/** Funnel stages, same colours everywhere (bars, legends, pills). */
export const STAGE = {
  signed: COPPER[500],
  uploaded: COPPER[300],
  opened: NAVY[500],
  invited: NAVY[300],
  notsent: NAVY[100],
} as const;
