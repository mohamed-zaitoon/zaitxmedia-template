const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zaitxNative", {
  platform: "linux",
  isNativeApp: true,
  appVersion: "1.0.0",
});
