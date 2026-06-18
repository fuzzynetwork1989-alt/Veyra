import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webOut = join(root, "..", "web", "out");
const desktopWww = join(root, "www");

if (!existsSync(webOut)) {
  console.error("Missing web static export. Run: NATIVE_BUILD=1 npm run build --workspace=@veyra/web");
  process.exit(1);
}

rmSync(desktopWww, { recursive: true, force: true });
mkdirSync(desktopWww, { recursive: true });
cpSync(webOut, desktopWww, { recursive: true });
console.log(`Synced ${webOut} -> ${desktopWww}`);