import { C, AD } from "./constants.js";

// Public IELTS page card style (green teal brand)
export const cardStyle = (extra = {}) => ({
  background: C.surface,
  border: `1px solid ${C.s200}`,
  borderRadius: 8,
  ...extra,
});

// Admin card style
export const adminCardStyle = (extra = {}) => ({
  background: AD.surface,
  border: `1px solid ${AD.border}`,
  borderRadius: 16,
  ...extra,
});

export const btnStyle = (variant = "primary", disabled = false) => {
  const map = {
    // Admin variants
    primary:   { background: disabled ? AD.muted : AD.blue,  color: "#fff",     border: "none",                        boxShadow: disabled ? "none" : "0 2px 8px rgba(45,93,220,.25)" },
    secondary: { background: AD.surface,                      color: AD.blue,    border: `1.5px solid ${AD.blue}` },
    ghost:     { background: "transparent",                   color: C.s600,     border: "none" },
    danger:    { background: AD.red,                          color: "#fff",     border: "none" },
    // Public IELTS test page variants (green brand)
    brand:     { background: disabled ? C.s200 : C.brand,    color: disabled ? C.s400 : "#fff", border: "none",        boxShadow: disabled ? "none" : "0 2px 8px rgba(17,205,135,.3)" },
    teal:      { background: disabled ? C.s200 : C.teal,     color: "#fff",     border: "none",                        boxShadow: disabled ? "none" : "0 2px 8px rgba(13,148,136,.25)" },
    violet:    { background: disabled ? C.s200 : "#11CD87",  color: disabled ? C.s400 : "#fff", border: "none",        boxShadow: disabled ? "none" : "0 2px 8px rgba(17,205,135,.3)" },
  };
  return {
    ...(map[variant] || map.primary),
    padding: "10px 22px", borderRadius: 6, fontSize: 13, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s",
    letterSpacing: "0.02em", whiteSpace: "nowrap",
  };
};

export const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 700, color: C.s600,
  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
};
