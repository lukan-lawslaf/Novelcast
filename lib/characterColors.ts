const palette = [
  { name: "purple", dot: "#7C6FE0", bg: "rgba(124,111,224,0.18)", border: "rgba(124,111,224,0.4)" },
  { name: "amber", dot: "#E7B85A", bg: "rgba(231,184,90,0.16)", border: "rgba(231,184,90,0.36)" },
  { name: "green", dot: "#7CC58B", bg: "rgba(124,197,139,0.15)", border: "rgba(124,197,139,0.34)" },
  { name: "coral", dot: "#E88072", bg: "rgba(232,128,114,0.15)", border: "rgba(232,128,114,0.34)" },
  { name: "sky", dot: "#78B9E6", bg: "rgba(120,185,230,0.15)", border: "rgba(120,185,230,0.34)" },
  { name: "pink", dot: "#D889C8", bg: "rgba(216,137,200,0.15)", border: "rgba(216,137,200,0.34)" },
  { name: "teal", dot: "#6AC9C3", bg: "rgba(106,201,195,0.15)", border: "rgba(106,201,195,0.34)" }
];

export function colorForCharacter(name: string, orderedNames: string[] = []) {
  const index = Math.max(0, orderedNames.indexOf(name));
  return palette[index % palette.length];
}

export function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "N";
}
