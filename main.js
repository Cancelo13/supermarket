const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { getAppPool, getPool } = require('./db.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    });

    win.loadFile('./renderer/index.html');
}

app.whenReady().then(async () => {
    await setupDatabase();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

async function setupDatabase() {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .query("SELECT database_id FROM sys.databases WHERE name = 'SupermarketDB'");

        if (result.recordset.length === 0) {
            console.log("Creating SupermarketDB database...");
            await pool.request().query("CREATE DATABASE SupermarketDB");
            console.log("SupermarketDB created successfully");
        } else {
            console.log("SupermarketDB already exists");
        }

        const appPool = await getAppPool();

        const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        await appPool.request().batch(schema);

        console.log("Schema applied successfully to SupermarketDB");
    } catch (err) {
        console.error("Database setup error:", err);
    }
}