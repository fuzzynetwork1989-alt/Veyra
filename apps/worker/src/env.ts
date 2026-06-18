import { existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/worker/.env"),
  resolve(__dirname, "../.env"),
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path });
    break;
  }
}