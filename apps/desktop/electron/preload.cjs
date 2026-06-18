const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("veyraDesktop", {
  platform: process.platform,
  version: "0.1.0",
});