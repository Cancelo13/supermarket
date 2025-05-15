const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
    redirectTo: (page) => {
        const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
        window.location.href = `${currentDir}/${page}`;
    }
});
