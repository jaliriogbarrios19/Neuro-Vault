const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("production");

const cssConcatPlugin = {
  name: "css-concat",
  setup(build) {
    build.onEnd(() => {
      const stylesDir = path.join(__dirname, "src", "styles");
      const files = fs
        .readdirSync(stylesDir)
        .filter((f) => f.endsWith(".css"))
        .sort();
      const css = files
        .map((f) => fs.readFileSync(path.join(stylesDir, f), "utf8"))
        .join("\n");
      fs.writeFileSync(path.join(__dirname, "styles.css"), css);
    });
  },
};

esbuild
  .build({
    entryPoints: ["main.ts"],
    bundle: true,
    external: ["obsidian", "electron"],
    format: "cjs",
    target: "es2020",
    platform: "browser",
    outfile: "main.js",
    sourcemap: production ? false : "inline",
    minify: production,
    treeShaking: true,
    plugins: [cssConcatPlugin],
  })
  .catch(() => process.exit(1));
