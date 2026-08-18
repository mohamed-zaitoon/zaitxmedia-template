const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require("electron");
const path = require("path");

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "ZAITX Media Admin — لوحة إدارة العمليات",
    icon: path.join(__dirname, "../../public/zaitx-logo-512.png"),
    backgroundColor: "#070a12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.loadURL("https://admin.zaitxmedia.com");

  // Prevent opening untrusted external links inside app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://admin.zaitxmedia.com") || url.startsWith("https://zaitxmedia.com")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "../../public/zaitx-logo-512.png");
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: "فتح لوحة الإدارة", click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: "separator" },
    { label: "إغلاق التطبيق", click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip("ZAITX Media Admin — Linux Desktop App");
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  try { createTray(); } catch(e) {}

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
