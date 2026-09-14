const { contextBridge, ipcRenderer } = require('electron');

// Exponiendo una API segura para enviar mensajes al proceso principal
contextBridge.exposeInMainWorld('socket2', {
  sendMessage: (message) => ipcRenderer.send('message-from-renderer', message),
  emit: ipcRenderer.send,
  on: (event, func) => {
    return ipcRenderer.on(event, func);
  },
  listen: (event, func) => {
    ipcRenderer.invoke(event, func);
  },
  listenToken: (event) => {
    return ipcRenderer.on('token_validation', event);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
