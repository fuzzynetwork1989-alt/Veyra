const { app, BrowserWindow, shell, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const isDev = process.env.VEYRA_DESKTOP_DEV === "1";
const WEB_DEV_URL = process.env.VEYRA_WEB_URL || "http://localhost:3000";
const WWW_DIR = path.join(__dirname, "..", "www");
const STATIC_INDEX = path.join(WWW_DIR, "index.html");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "veyra",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveWwwPath(urlPathname) {
  let reqPath = decodeURIComponent(urlPathname).replace(/^\/+/, "");
  if (!reqPath || reqPath === "app" || reqPath === "app/") {
    return path.join(WWW_DIR, "index.html");
  }
  if (reqPath.startsWith("app/")) {
    reqPath = reqPath.slice(4);
  }
  if (reqPath.endsWith("/")) {
    reqPath += "index.html";
  }
  if (!path.extname(reqPath)) {
    const asDir = path.join(WWW_DIR, reqPath, "index.html");
    if (fs.existsSync(asDir)) return asDir;
  }
  const filePath = path.normalize(path.join(WWW_DIR, reqPath));
  if (!filePath.startsWith(WWW_DIR)) {
    return null;
  }
  if (fs.existsSync(filePath)) return filePath;
  return path.join(WWW_DIR, "index.html");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Veyra",
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.once("ready-to-show", () => {
    win.show();
    win.webContents.setZoomFactor(1);
  });

  if (isDev) {
    win.loadURL(WEB_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL("veyra://app/index.html");
  }
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle("veyra", (request) => {
      const filePath = resolveWwwPath(new URL(request.url).pathname);
      if (!filePath) {
        return new Response("Forbidden", { status: 403 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    });
  }

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});