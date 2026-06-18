import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webOut = join(root, "..", "web", "out");
const mobileWww = join(root, "www");

if (!existsSync(webOut)) {
  console.error("Missing web static export. Run: NATIVE_BUILD=1 npm run build --workspace=@veyra/web");
  process.exit(1);
}

rmSync(mobileWww, { recursive: true, force: true });
mkdirSync(mobileWww, { recursive: true });
cpSync(webOut, mobileWww, { recursive: true });
console.log(`Synced ${webOut} -> ${mobileWww}`);