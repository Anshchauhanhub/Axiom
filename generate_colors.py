dark = {
  "tertiary-fixed": "#ffdcc6", "outline": "#8c909f", "on-tertiary-container": "#461f00", "on-secondary-container": "#00424e",
  "primary-container": "#fdb813", "background": "#0e0e10", "surface-container-lowest": "#0e0e10", "on-surface-variant": "#c2c6d6",
  "tertiary-container": "#e65100", "tertiary": "#ffb786", "on-tertiary-fixed-variant": "#723600", "on-secondary-fixed-variant": "#004e5c",
  "inverse-surface": "#e5e1e4", "on-primary-container": "#251a00", "surface-tint": "#fdb813", "on-background": "#e5e1e4",
  "on-error": "#690005", "surface-container-low": "#1c1b1d", "surface-dim": "#0e0e10", "secondary-container": "#00b359",
  "on-primary-fixed-variant": "#004395", "surface-variant": "#353437", "surface-container-high": "#2a2a2c", "on-tertiary-fixed": "#311400",
  "on-secondary-fixed": "#001f26", "on-tertiary": "#502400", "surface": "#0e0e10", "error": "#ffb4ab", "surface-container": "#201f22",
  "on-surface": "#e5e1e4", "on-error-container": "#ffdad6", "error-container": "#93000a", "surface-bright": "#39393b",
  "secondary": "#00b359", "secondary-fixed-dim": "#00b359", "secondary-fixed": "#acedff", "on-secondary": "#ffffff",
  "on-primary": "#251a00", "outline-variant": "#424754", "tertiary-fixed-dim": "#ffb786", "primary-fixed": "#ffdf99",
  "primary-fixed-dim": "#fdb813", "inverse-primary": "#005ac2", "inverse-on-surface": "#313032", "surface-container-highest": "#353437",
  "primary": "#fdb813", "on-primary-fixed": "#001a42"
}

light = {
  "background": "#faf9fa", "on-background": "#1a1b1e",
  "surface": "#faf9fa", "on-surface": "#1a1b1e",
  "surface-variant": "#e2e2e5", "on-surface-variant": "#44464f",
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#f4f3f6",
  "surface-container": "#eeeeef",
  "surface-container-high": "#e8e7ea",
  "surface-container-highest": "#e2e2e5",
  "surface-dim": "#dbdade",
  "surface-bright": "#faf9fa",
  "inverse-surface": "#2f3033", "inverse-on-surface": "#f1f0f4",
  "primary": "#fdb813", "on-primary": "#251a00", "primary-container": "#ffdf99", "on-primary-container": "#251a00",
  "secondary": "#00b359", "on-secondary": "#ffffff", "secondary-container": "#8bf6b4", "on-secondary-container": "#00210e",
  "tertiary": "#9c4300", "on-tertiary": "#ffffff", "tertiary-container": "#ffb786", "on-tertiary-container": "#351000",
  "error": "#ba1a1a", "on-error": "#ffffff", "error-container": "#ffdad6", "on-error-container": "#410002",
  "outline": "#757780", "outline-variant": "#c5c6d0",
  "primary-fixed": "#ffdf99", "primary-fixed-dim": "#fdb813", "on-primary-fixed": "#251a00", "on-primary-fixed-variant": "#4d3a00",
  "secondary-fixed": "#8bf6b4", "secondary-fixed-dim": "#00b359", "on-secondary-fixed": "#00210e", "on-secondary-fixed-variant": "#005226",
  "tertiary-fixed": "#ffdcc6", "tertiary-fixed-dim": "#ffb786", "on-tertiary-fixed": "#311400", "on-tertiary-fixed-variant": "#723600",
}

print("/* CSS VARIABLES */")
print(":root {")
for k, v in light.items(): print(f"  --{k}: {v};")
# Ensure any missing keys in light use dark as fallback
for k, v in dark.items():
    if k not in light: print(f"  --{k}: {v};")
print("}")

print("\n.dark {")
for k, v in dark.items(): print(f"  --{k}: {v};")
print("}")
