const lintStagedConfig = {
  "*.{js,mjs,cjs,ts,mts,tsx}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  "*.{json,md,css,yml,yaml}": ["prettier --write"],
};

export default lintStagedConfig;
