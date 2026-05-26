import { app, BrowserWindow } from 'electron';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
  });
  
  win.loadURL('https://thebadlorax.dev');
}

app.whenReady().then(createWindow);