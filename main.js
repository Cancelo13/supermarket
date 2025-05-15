const { app, BrowserWindow, ipcMain } = require('electron');
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

            const appPool = await getAppPool();
            const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await appPool.request().batch(schema);
            console.log("Schema applied successfully to SupermarketDB");
        } else {
            console.log("SupermarketDB already exists, skipping schema creation");
        }
    } catch (err) {
        console.error("Database setup error:", err);
    }
}

ipcMain.handle('database:execute-query', async (event, { query, params }) => {
    try {
        const pool = await getAppPool();
        const request = pool.request();

        // Add parameters if provided
        if (params && Array.isArray(params)) {
            params.forEach((param, index) => {
                request.input(`param${index}`, param);
            });
        }

        const result = await request.query(query);
        return {
            status: true,
            data: result.recordset,
            rowsAffected: result.rowsAffected
        };
    } catch (error) {
        console.error('Database query error:', error);
        return {
            status: false,
            error: error.message,
            data: null
        };
    }
});

ipcMain.handle('database:execute-batch', async (event, { queries }) => {
    try {
        const pool = await getAppPool();
        const results = [];

        for (const query of queries) {
            const result = await pool.request().batch(query);
            results.push({
                status: true,
                data: result.recordset,
                rowsAffected: result.rowsAffected
            });
        }

        return {
            status: true,
            results
        };
    } catch (error) {
        console.error('Database batch error:', error);
        return {
            status: false,
            error: error.message,
            results: null
        };
    }
});

ipcMain.handle('auth:login', async (event, data) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('username', data.username)
            .input('password', data.password)
            .query(`
                -- Try customer login first
                SELECT 
                    CustomerID as id,
                    Name as name,
                    Email as email,
                    'customer' as role,
                    ISNULL(Address, '') as address
                FROM Customer 
                WHERE Email = @username 
                  AND Password = @password
                  AND Email IS NOT NULL
                UNION ALL
                -- Then try admin login
                SELECT 
                    AdminID as id,
                    Admin_Name as name,
                    Admin_Name as email,
                    'admin' as role,
                    '' as address
                FROM Admin
                WHERE Admin_Name = @username 
                  AND Admin_Pass = @password
            `);

        if (result.recordset.length > 0) {
            return {
                success: true,
                user: result.recordset[0]
            };
        } else {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'Server error occurred'
        };
    }
});

ipcMain.handle('auth:register', async (event, data) => {
    try {
        const pool = await getAppPool();

        // Check if email already exists
        const checkResult = await pool.request()
            .input('email', data.email)
            .query('SELECT Email FROM Customer WHERE Email = @email');

        if (checkResult.recordset.length > 0) {
            return {
                success: false,
                message: 'Email already registered'
            };
        }

        // Get next CustomerID
        const idResult = await pool.request()
            .query('SELECT ISNULL(MAX(CustomerID), 0) + 1 as nextId FROM Customer');

        const customerId = idResult.recordset[0].nextId;

        // Insert new customer
        const result = await pool.request()
            .input('id', customerId)
            .input('name', data.name)
            .input('email', data.email)
            .input('password', data.password)
            .input('address', data.address || null)
            .query(`
                INSERT INTO Customer (
                    CustomerID, 
                    Name, 
                    Email, 
                    Password, 
                    Address
                ) VALUES (
                    @id,
                    @name,
                    @email,
                    @password,
                    @address
                );
                
                SELECT 
                    @id as id,
                    @name as name,
                    @email as email,
                    'customer' as role,
                    ISNULL(@address, '') as address
            `);

        return {
            success: true,
            user: result.recordset[0]
        };
    } catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            message: 'Server error occurred'
        };
    }
});