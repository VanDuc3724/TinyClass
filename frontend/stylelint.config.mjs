const fontSize = "var\\(--tc-font-size-(?:xs|sm|md|lg|xl|[2-5]xl)\\)";
const radius = "(?:0|50%|var\\(--tc-radius-(?:sm|md|lg|xl|pill)\\))";

export default {
  rules: {
    "color-no-hex": true,
    "declaration-property-value-allowed-list": {
      "font": ["inherit"],
      "font-size": [
        "inherit",
        new RegExp(`^${fontSize}$`),
        new RegExp(`^clamp\\(${fontSize},\\s*[\\d.]+vw,\\s*${fontSize}\\)$`),
      ],
      "/^border(?:-[a-z-]+)?-radius$/": [
        new RegExp(`^${radius}(?:\\s+${radius}){0,3}$`),
      ],
    },
  },
  overrides: [
    {
      files: ["src/styles/tokens.css"],
      rules: { "color-no-hex": null },
    },
    {
      files: ["src/**/*.module.css"],
      rules: {
        "rule-nesting-at-rule-required-list": ["layer"],
        "layer-name-pattern": "^components$",
      },
    },
  ],
};
