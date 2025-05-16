const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const { getAppPool, getPool } = require('./db.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        autoHideMenuBar: true,
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
    try {
        await setupDatabase();
        createWindow();
    } catch (error) {
        console.error("Failed to initialize application:", error);
        app.quit();
    }
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
        }

        const appPool = await getAppPool();

        const dbSetupCheck = await appPool.request()
            .query("SELECT AdminID FROM Admin WHERE AdminID = 1");

        if (dbSetupCheck.recordset.length > 0) {
            console.log("Database already set up, skipping initialization");
            return;
        }

        const dropTablesPath = path.join(__dirname, 'sql', 'drop.sql');
        const dropTables = fs.readFileSync(dropTablesPath, 'utf-8');
        await appPool.request().batch(dropTables);
        console.log("Existing tables dropped successfully");

        const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await appPool.request().batch(schema);
        console.log("Schema applied successfully to SupermarketDB");

        const adminExists = await appPool.request()
            .query("SELECT 1 FROM Admin WHERE AdminID = 1");

        if (adminExists.recordset.length === 0) {
            await appPool.request()
                .input('adminName', 'admin')
                .input('adminPass', 'admin123')
                .query(`
                    INSERT INTO Admin (AdminID, Admin_Name, Admin_Pass)
                    VALUES (1, @adminName, @adminPass)
                `);
            console.log("Default admin user created successfully");
        }

        const uniqueConstraintPath = path.join(__dirname, 'sql', 'update_schema.sql');
        const uniqueConstraint = fs.readFileSync(uniqueConstraintPath, 'utf-8');
        await appPool.request().batch(uniqueConstraint);
        console.log("Schema updates applied successfully");


    } catch (err) {
        console.error("Database setup error:", err);
        throw err;
    }
}

ipcMain.handle('database:execute-query', async (event, { query, params }) => {
    try {
        const pool = await getAppPool();
        const request = pool.request();

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
                SELECT 
                    AdminID as id,
                    Admin_Name as name,
                    Admin_Name as username,
                    'admin' as role,
                    '' as address
                FROM Admin
                WHERE Admin_Name = @username 
                  AND Admin_Pass = @password
                UNION ALL
                SELECT 
                    CustomerID as id,
                    Name as name,
                    Email as username,
                    'customer' as role,
                    ISNULL(Address, '') as address
                FROM Customer 
                WHERE Email = @username 
                  AND Password = @password
                  AND Email IS NOT NULL
            `);

        if (result.recordset.length > 0) {
            global.currentUser = result.recordset[0];
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

        const checkResult = await pool.request()
            .input('email', data.email)
            .query('SELECT Email FROM Customer WHERE Email = @email');

        if (checkResult.recordset.length > 0) {
            return {
                success: false,
                message: 'Email already registered'
            };
        }

        const idResult = await pool.request()
            .query('SELECT ISNULL(MAX(CustomerID), 0) + 1 as nextId FROM Customer');

        const customerId = idResult.recordset[0].nextId;

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

ipcMain.handle('auth:get-current-user', async (event) => {
    try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
            return {
                success: false,
                message: 'Window not found'
            };
        }

        const userData = global.currentUser;

        if (!userData) {
            return {
                success: false,
                message: 'No user logged in'
            };
        }

        return {
            success: true,
            user: userData
        };
    } catch (error) {
        console.error('Error getting current user:', error);
        return {
            success: false,
            message: 'Failed to get current user'
        };
    }
});

ipcMain.handle('auth:logout', async (event) => {
    try {
        global.currentUser = null;
        return {
            success: true,
            message: 'Logged out successfully'
        };
    } catch (error) {
        console.error('Logout error:', error);
        return {
            success: false,
            message: 'Failed to logout'
        };
    }
});

ipcMain.handle('product:add', async (event, productData) => {
    try {
        const pool = await getAppPool();

        if (!productData.name || !productData.categoryId || !productData.price || productData.quantity === undefined) {
            throw new Error('Missing required product data');
        }

        const checkResult = await pool.request()
            .input('name', sql.VarChar(100), productData.name)
            .query(`
                SELECT Prod_Name 
                FROM Product 
                WHERE LOWER(Prod_Name) = LOWER(@name)
            `);

        if (checkResult.recordset.length > 0) {
            return {
                success: false,
                message: 'A product with this name already exists'
            };
        }

        const idResult = await pool.request()
            .query('SELECT ISNULL(MAX(ProductID), 0) + 1 as nextId FROM Product');
        const productId = idResult.recordset[0].nextId;

        const invResult = await pool.request()
            .query('SELECT ISNULL(MAX(InventoryID), 0) + 1 as nextId FROM Inventory');
        const inventoryId = invResult.recordset[0].nextId;

        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            await transaction.request()
                .input('inventoryId', sql.Int, inventoryId)
                .input('adminId', sql.Int, 1)
                .input('quantity', sql.Int, productData.quantity)
                .input('location', sql.VarChar(100), productData.location || '')
                .query(`
                    INSERT INTO Inventory (InventoryID, AdminID, Quantity, Location)
                    VALUES (@inventoryId, @adminId, @quantity, @location)
                `);

            await transaction.request()
                .input('productId', sql.Int, productId)
                .input('categoryId', sql.Int, productData.categoryId)
                .input('inventoryId', sql.Int, inventoryId)
                .input('name', sql.VarChar(100), productData.name)
                .input('price', sql.Decimal(10, 2), productData.price)
                .input('quantity', sql.Int, productData.quantity)
                .query(`
                    INSERT INTO Product (ProductID, CategoryID, InventoryID, Prod_Name, Prod_Price, Quantity)
                    VALUES (@productId, @categoryId, @inventoryId, @name, @price, @quantity)
                `);

            await transaction.commit();
            console.log('Product added successfully'); // Debug log
            return {
                success: true,
                message: 'Product added successfully',
                productId: productId
            };
        } catch (err) {
            console.error('Transaction error:', err); // Debug log
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error adding product:', error); // Debug log
        return {
            success: false,
            message: error.message || 'Failed to add product'
        };
    }
});

ipcMain.handle('category:add', async (event, data) => {
    try {
        const pool = await getAppPool();

        const idResult = await pool.request()
            .query('SELECT ISNULL(MAX(CategoryID), 0) + 1 as nextId FROM Category');
        const categoryId = idResult.recordset[0].nextId;

        const result = await pool.request()
            .input('id', categoryId)
            .input('name', data.name)
            .query(`
                INSERT INTO Category (CategoryID, Category_Name)
                VALUES (@id, @name);
                
                SELECT CategoryID, Category_Name 
                FROM Category 
                WHERE CategoryID = @id;
            `);

        return {
            success: true,
            category: result.recordset[0]
        };
    } catch (error) {
        console.error('Error adding category:', error);
        return {
            success: false,
            message: 'Failed to add category'
        };
    }
});

ipcMain.handle('category:getAll', async (event) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query('SELECT CategoryID, Category_Name FROM Category ORDER BY Category_Name');

        return {
            success: true,
            categories: result.recordset
        };
    } catch (error) {
        console.error('Error fetching categories:', error);
        return {
            success: false,
            message: 'Failed to fetch categories'
        };
    }
});

ipcMain.handle('product:update', async (event, productData) => {
    try {
        const pool = await getAppPool();

        const checkResult = await pool.request()
            .input('name', sql.VarChar(100), productData.name)
            .input('id', sql.Int, productData.id)
            .query(`
                SELECT Prod_Name 
                FROM Product 
                WHERE LOWER(Prod_Name) = LOWER(@name) 
                AND ProductID != @id
            `);

        if (checkResult.recordset.length > 0) {
            return {
                success: false,
                message: 'A product with this name already exists'
            };
        }

        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            await transaction.request()
                .input('id', sql.Int, productData.id)
                .input('categoryId', sql.Int, productData.categoryId)
                .input('name', sql.VarChar(100), productData.name)
                .input('price', sql.Decimal(10, 2), productData.price)
                .input('quantity', sql.Int, productData.quantity)
                .query(`
                    UPDATE Product 
                    SET CategoryID = @categoryId,
                        Prod_Name = @name,
                        Prod_Price = @price,
                        Quantity = @quantity
                    WHERE ProductID = @id;

                    UPDATE Inventory
                    SET Quantity = @quantity,
                        Location = @location
                    FROM Inventory i
                    INNER JOIN Product p ON i.InventoryID = p.InventoryID
                    WHERE p.ProductID = @id;
                `);

            await transaction.commit();
            return {
                success: true,
                message: 'Product updated successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error updating product:', error);
        return {
            success: false,
            message: error.message || 'Failed to update product'
        };
    }
});

ipcMain.handle('product:delete', async (event, { id }) => {
    try {
        const pool = await getAppPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            const inventoryResult = await transaction.request()
                .input('id', sql.Int, id)
                .query('SELECT InventoryID FROM Product WHERE ProductID = @id');

            const inventoryId = inventoryResult.recordset[0]?.InventoryID;

            await transaction.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Product WHERE ProductID = @id');

            if (inventoryId) {
                await transaction.request()
                    .input('inventoryId', sql.Int, inventoryId)
                    .query('DELETE FROM Inventory WHERE InventoryID = @inventoryId');
            }

            await transaction.commit();
            return {
                success: true,
                message: 'Product deleted successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete product'
        };
    }
});

ipcMain.handle('inventory:getAll', async (event) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT 
                    i.InventoryID,
                    p.ProductID,
                    p.Prod_Name,
                    c.Category_Name,
                    i.Location,
                    i.Quantity,
                    CASE 
                        WHEN i.Quantity > 20 THEN 'In Stock'
                        WHEN i.Quantity > 0 THEN 'Low Stock'
                        ELSE 'Out of Stock'
                    END as Status
                FROM Inventory i
                INNER JOIN Product p ON i.InventoryID = p.InventoryID
                LEFT JOIN Category c ON p.CategoryID = c.CategoryID
                ORDER BY p.Prod_Name ASC
            `);

        return {
            success: true,
            inventory: result.recordset
        };
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return {
            success: false,
            message: 'Failed to fetch inventory'
        };
    }
});

ipcMain.handle('inventory:update', async (event, data) => {
    try {
        const pool = await getAppPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            await transaction.request()
                .input('id', sql.Int, data.inventoryId)
                .input('quantity', sql.Int, data.quantity)
                .input('location', sql.VarChar(100), data.location)
                .query(`
                    UPDATE Inventory 
                    SET Quantity = @quantity,
                        Location = @location
                    WHERE InventoryID = @id;

                    UPDATE Product
                    SET Quantity = @quantity
                    WHERE InventoryID = @id;
                `);

            await transaction.commit();
            return {
                success: true,
                message: 'Inventory updated successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error updating inventory:', error);
        return {
            success: false,
            message: error.message || 'Failed to update inventory'
        };
    }
});

ipcMain.handle('inventory:getLowStock', async (event, threshold = 20) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('threshold', sql.Int, threshold)
            .query(`
                SELECT 
                    i.InventoryID,
                    p.ProductID,
                    p.Prod_Name,
                    c.Category_Name,
                    i.Location,
                    i.Quantity
                FROM Inventory i
                INNER JOIN Product p ON i.InventoryID = p.InventoryID
                LEFT JOIN Category c ON p.CategoryID = c.CategoryID
                WHERE i.Quantity <= @threshold
                ORDER BY i.Quantity ASC
            `);

        return {
            success: true,
            lowStock: result.recordset
        };
    } catch (error) {
        console.error('Error fetching low stock:', error);
        return {
            success: false,
            message: 'Failed to fetch low stock items'
        };
    }
});

ipcMain.handle('customer:getAll', async (event) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT 
                    CustomerID,
                    Name,
                    Email,
                    Address,
                    (SELECT COUNT(*) FROM "Order" WHERE CustomerID = c.CustomerID) as OrderCount
                FROM Customer c
                ORDER BY CustomerID DESC
            `);

        return {
            success: true,
            customers: result.recordset
        };
    } catch (error) {
        console.error('Error fetching customers:', error);
        return {
            success: false,
            message: 'Failed to fetch customers'
        };
    }
});

ipcMain.handle('customer:add', async (event, customerData) => {
    try {
        const pool = await getAppPool();

        if (customerData.email) {
            const emailCheck = await pool.request()
                .input('email', sql.VarChar(100), customerData.email)
                .query('SELECT CustomerID FROM Customer WHERE Email = @email');

            if (emailCheck.recordset.length > 0) {
                return {
                    success: false,
                    message: 'Email already registered'
                };
            }
        }

        const idResult = await pool.request()
            .query('SELECT ISNULL(MAX(CustomerID), 0) + 1 as nextId FROM Customer');
        const customerId = idResult.recordset[0].nextId;

        const result = await pool.request()
            .input('id', sql.Int, customerId)
            .input('name', sql.VarChar(100), customerData.name)
            .input('email', sql.VarChar(100), customerData.email)
            .input('password', sql.VarChar(100), customerData.password)
            .input('address', sql.VarChar(255), customerData.address)
            .query(`
                INSERT INTO Customer (CustomerID, Name, Email, Password, Address)
                VALUES (@id, @name, @email, @password, @address);
                
                SELECT CustomerID, Name, Email, Address 
                FROM Customer 
                WHERE CustomerID = @id;
            `);

        return {
            success: true,
            customer: result.recordset[0],
            message: 'Customer added successfully'
        };
    } catch (error) {
        console.error('Error adding customer:', error);
        return {
            success: false,
            message: error.message || 'Failed to add customer'
        };
    }
});

ipcMain.handle('customer:update', async (event, customerData) => {
    try {
        const pool = await getAppPool();

        if (customerData.email) {
            const emailCheck = await pool.request()
                .input('email', sql.VarChar(100), customerData.email)
                .input('id', sql.Int, customerData.id)
                .query('SELECT CustomerID FROM Customer WHERE Email = @email AND CustomerID != @id');

            if (emailCheck.recordset.length > 0) {
                return {
                    success: false,
                    message: 'Email already registered to another customer'
                };
            }
        }

        await pool.request()
            .input('id', sql.Int, customerData.id)
            .input('name', sql.VarChar(100), customerData.name)
            .input('email', sql.VarChar(100), customerData.email)
            .input('address', sql.VarChar(255), customerData.address)
            .query(`
                UPDATE Customer 
                SET Name = @name,
                    Email = @email,
                    Address = @address
                WHERE CustomerID = @id
            `);

        return {
            success: true,
            message: 'Customer updated successfully'
        };
    } catch (error) {
        console.error('Error updating customer:', error);
        return {
            success: false,
            message: error.message || 'Failed to update customer'
        };
    }
});

ipcMain.handle('customer:delete', async (event, { id }) => {
    try {
        const pool = await getAppPool();

        const orderCheck = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT OrderID FROM "Order" WHERE CustomerID = @id');

        if (orderCheck.recordset.length > 0) {
            return {
                success: false,
                message: 'Cannot delete customer with existing orders'
            };
        }

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Customer WHERE CustomerID = @id');

        return {
            success: true,
            message: 'Customer deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting customer:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete customer'
        };
    }
});


ipcMain.handle('order:create', async (event, orderData) => {
    try {
        const pool = await getAppPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            const idResult = await transaction.request()
                .query('SELECT ISNULL(MAX(OrderID), 0) + 1 as nextId FROM "Order"');
            const orderId = idResult.recordset[0].nextId;

            await transaction.request()
                .input('orderId', sql.Int, orderId)
                .input('customerId', sql.Int, orderData.customerId)
                .input('address', sql.VarChar(255), orderData.shippingAddress)
                .input('total', sql.Decimal(10, 2), orderData.total)
                .input('status', sql.Int, 1) // 1 = Pending
                .query(`
                    INSERT INTO "Order" (OrderID, CustomerID, Order_Date, Shipping_Address, Amount, Status)
                    VALUES (@orderId, @customerId, GETDATE(), @address, @total, @status)
                `);

            for (const item of orderData.items) {
                await transaction.request()
                    .input('orderId', sql.Int, orderId)
                    .input('productId', sql.Int, item.productId)
                    .input('quantity', sql.Int, item.quantity)
                    .input('price', sql.Decimal(10, 2), item.price)
                    .query(`
                        INSERT INTO OrderItem (OrderID, ProductID, Quantity, Unit_Price)
                        VALUES (@orderId, @productId, @quantity, @price);

                        UPDATE p
                        SET p.Quantity = p.Quantity - @quantity
                        FROM Product p
                        WHERE p.ProductID = @productId;

                        UPDATE i
                        SET i.Quantity = i.Quantity - @quantity
                        FROM Inventory i
                        JOIN Product p ON i.InventoryID = p.InventoryID
                        WHERE p.ProductID = @productId;
                    `);
            }

            if (orderData.voucherId) {
                await transaction.request()
                    .input('voucherId', sql.Int, orderData.voucherId)
                    .input('orderId', sql.Int, orderId)
                    .query(`
                        UPDATE Voucher
                        SET Used = 1,
                            Used_Date = GETDATE(),
                            OrderID = @orderId
                        WHERE VoucherID = @voucherId
                    `);
            }

            await transaction.commit();
            return {
                success: true,
                orderId: orderId,
                message: 'Order placed successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error creating order:', error);
        return {
            success: false,
            message: error.message || 'Failed to create order'
        };
    }
});

ipcMain.handle('voucher:getAvailable', async (event, customerId) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT 
                    VoucherID,
                    Code,
                    Discount_Amount,
                    Expiry_Date,
                    Min_Purchase_Amount
                FROM Voucher
                WHERE CustomerID = @customerId
                AND Used = 0
                AND Expiry_Date > GETDATE()
                ORDER BY Expiry_Date ASC
            `);

        return {
            success: true,
            vouchers: result.recordset
        };
    } catch (error) {
        console.error('Error fetching vouchers:', error);
        return {
            success: false,
            message: 'Failed to fetch vouchers'
        };
    }
});

ipcMain.handle('order:getAll', async (event) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT 
                    o.OrderID,
                    o.CustomerID,
                    c.Name as CustomerName,
                    o.Order_Date,
                    o.Shipping_Address,
                    o.Amount,
                    o.Status,
                    COUNT(oi.ProductID) as ItemCount,
                    STUFF((
                        SELECT ', ' + p.Prod_Name
                        FROM OrderItem oi2
                        JOIN Product p ON oi2.ProductID = p.ProductID
                        WHERE oi2.OrderID = o.OrderID
                        FOR XML PATH('')
                    ), 1, 2, '') as Products
                FROM "Order" o
                JOIN Customer c ON o.CustomerID = c.CustomerID
                LEFT JOIN OrderItem oi ON o.OrderID = oi.OrderID
                GROUP BY 
                    o.OrderID, 
                    o.CustomerID,
                    c.Name,
                    o.Order_Date,
                    o.Shipping_Address,
                    o.Amount,
                    o.Status
                ORDER BY o.Order_Date DESC
            `);

        return {
            success: true,
            orders: result.recordset
        };
    } catch (error) {
        console.error('Error fetching orders:', error);
        return {
            success: false,
            message: 'Failed to fetch orders'
        };
    }
});

ipcMain.handle('order:update', async (event, { orderId, status, notes }) => {
    try {
        const pool = await getAppPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            await transaction.request()
                .input('orderId', sql.Int, orderId)
                .input('status', sql.Int, status)
                .query(`
                    UPDATE "Order"
                    SET Status = @status
                    WHERE OrderID = @orderId
                `);

            if (status === 5) { // 5 = Cancelled
                await transaction.request()
                    .input('orderId', sql.Int, orderId)
                    .query(`
                        -- Update Product quantities
                        UPDATE p
                        SET p.Quantity = p.Quantity + oi.Quantity
                        FROM Product p
                        JOIN OrderItem oi ON p.ProductID = oi.ProductID
                        WHERE oi.OrderID = @orderId;

                        -- Update Inventory quantities
                        UPDATE i
                        SET i.Quantity = i.Quantity + oi.Quantity
                        FROM Inventory i
                        JOIN Product p ON i.InventoryID = p.InventoryID
                        JOIN OrderItem oi ON p.ProductID = oi.ProductID
                        WHERE oi.OrderID = @orderId;
                    `);
            }

            await transaction.commit();
            return {
                success: true,
                message: 'Order status updated successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error updating order:', error);
        return {
            success: false,
            message: error.message || 'Failed to update order'
        };
    }
});

ipcMain.handle('order:getDetails', async (event, orderId) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('orderId', sql.Int, orderId)
            .query(`
                SELECT 
                    o.OrderID,
                    o.CustomerID,
                    c.Name as CustomerName,
                    c.Email as CustomerEmail,
                    o.Order_Date,
                    o.Shipping_Address,
                    o.Amount,
                    o.Status,
                    oi.ProductID,
                    p.Prod_Name,
                    oi.Quantity,
                    oi.Unit_Price,
                    (oi.Quantity * oi.Unit_Price) as ItemTotal,
                    cat.Category_Name
                FROM "Order" o
                JOIN Customer c ON o.CustomerID = c.CustomerID
                JOIN OrderItem oi ON o.OrderID = oi.OrderID
                JOIN Product p ON oi.ProductID = p.ProductID
                LEFT JOIN Category cat ON p.CategoryID = cat.CategoryID
                WHERE o.OrderID = @orderId
            `);

        if (result.recordset.length === 0) {
            return {
                success: false,
                message: 'Order not found'
            };
        }

        return {
            success: true,
            orderDetails: {
                order: {
                    id: result.recordset[0].OrderID,
                    customerName: result.recordset[0].CustomerName,
                    customerEmail: result.recordset[0].CustomerEmail,
                    orderDate: result.recordset[0].Order_Date,
                    shippingAddress: result.recordset[0].Shipping_Address,
                    amount: result.recordset[0].Amount,
                    status: result.recordset[0].Status
                },
                items: result.recordset.map(item => ({
                    productId: item.ProductID,
                    productName: item.Prod_Name,
                    category: item.Category_Name,
                    quantity: item.Quantity,
                    unitPrice: item.Unit_Price,
                    total: item.ItemTotal
                }))
            }
        };
    } catch (error) {
        console.error('Error fetching order details:', error);
        return {
            success: false,
            message: 'Failed to fetch order details'
        };
    }
});

ipcMain.handle('voucher:create', async (event, voucherData) => {
    try {
        const pool = await getAppPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            const idResult = await transaction.request()
                .query('SELECT ISNULL(MAX(VoucherID), 0) + 1 as nextId FROM Voucher');
            const voucherId = idResult.recordset[0].nextId;

            const code = `VC${voucherId.toString().padStart(6, '0')}`;

            await transaction.request()
                .input('voucherId', sql.Int, voucherId)
                .input('code', sql.VarChar(10), code)
                .input('amount', sql.Decimal(10, 2), voucherData.amount)
                .input('expiry', sql.DateTime, voucherData.expiryDate)
                .input('customerId', sql.Int, voucherData.customerId)
                .input('minPurchase', sql.Decimal(10, 2), voucherData.minPurchaseAmount || 0)
                .query(`
                    INSERT INTO Voucher (
                        VoucherID,
                        Code,
                        Discount_Amount,
                        Expiry_Date,
                        CustomerID,
                        Created_Date,
                        Used,
                        Min_Purchase_Amount
                    ) VALUES (
                        @voucherId,
                        @code,
                        @amount,
                        @expiry,
                        @customerId,
                        GETDATE(),
                        0,
                        @minPurchase
                    )
                `);

            await transaction.commit();

            return {
                success: true,
                voucherId: voucherId,
                code: code,
                message: 'Voucher created successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error creating voucher:', error);
        return {
            success: false,
            message: error.message || 'Failed to create voucher'
        };
    }
});

ipcMain.handle('voucher:update', async (event, voucherData) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('id', sql.Int, voucherData.id)
            .input('amount', sql.Decimal(10, 2), voucherData.amount)
            .input('expiry', sql.DateTime, voucherData.expiryDate)
            .input('customerId', sql.Int, voucherData.customerId)
            .input('minPurchase', sql.Decimal(10, 2), voucherData.minPurchaseAmount || 0)
            .query(`
                UPDATE Voucher
                SET Discount_Amount = @amount,
                    Expiry_Date = @expiry,
                    CustomerID = @customerId,
                    Min_Purchase_Amount = @minPurchase
                WHERE VoucherID = @id AND Used = 0
            `);

        return {
            success: true,
            message: 'Voucher updated successfully'
        };
    } catch (error) {
        console.error('Error updating voucher:', error);
        return {
            success: false,
            message: error.message || 'Failed to update voucher'
        };
    }
});

ipcMain.handle('voucher:delete', async (event, { id }) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Voucher WHERE VoucherID = @id AND Used = 0');

        return {
            success: true,
            message: 'Voucher deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting voucher:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete voucher'
        };
    }
});

ipcMain.handle('dashboard:getSummaryStats', async () => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM Product) as TotalProducts,
                    (SELECT COUNT(*) FROM Category) as TotalCategories,
                    (SELECT COUNT(*) FROM Customer) as TotalCustomers,
                    (SELECT COUNT(*) FROM "Order") as TotalOrders,
                    (SELECT COUNT(*) FROM "Order" WHERE Status = 1) as PendingOrders,
                    (SELECT ISNULL(SUM(Amount), 0) FROM "Order" WHERE Status != 5) as TotalRevenue,
                    (SELECT COUNT(*) FROM Product WHERE Quantity <= 20) as LowStockCount
            `);

        return {
            success: true,
            stats: result.recordset[0]
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return {
            success: false,
            message: 'Failed to fetch dashboard statistics'
        };
    }
});

ipcMain.handle('dashboard:getRecentOrders', async () => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 5
                    o.OrderID,
                    c.Name as CustomerName,
                    o.Amount,
                    o.Status,
                    o.Order_Date
                FROM "Order" o
                JOIN Customer c ON o.CustomerID = c.CustomerID
                ORDER BY o.Order_Date DESC
            `);

        return {
            success: true,
            orders: result.recordset
        };
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        return {
            success: false,
            message: 'Failed to fetch recent orders'
        };
    }
});

ipcMain.handle('dashboard:getTopProducts', async () => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 5
                    p.ProductID,
                    p.Prod_Name,
                    p.Prod_Price,
                    SUM(oi.Quantity) as TotalSold,
                    SUM(oi.Quantity * oi.Unit_Price) as TotalRevenue
                FROM Product p
                JOIN OrderItem oi ON p.ProductID = oi.ProductID
                JOIN "Order" o ON oi.OrderID = o.OrderID
                WHERE o.Status != 5
                GROUP BY p.ProductID, p.Prod_Name, p.Prod_Price
                ORDER BY TotalSold DESC
            `);

        return {
            success: true,
            products: result.recordset
        };
    } catch (error) {
        console.error('Error fetching top products:', error);
        return {
            success: false,
            message: 'Failed to fetch top products'
        };
    }
});

ipcMain.handle('dashboard:getLowStockProducts', async () => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 5
                    p.ProductID,
                    p.Prod_Name,
                    c.Category_Name,
                    p.Quantity,
                    i.Location
                FROM Product p
                JOIN Category c ON p.CategoryID = c.CategoryID
                JOIN Inventory i ON p.InventoryID = i.InventoryID
                WHERE p.Quantity <= 20
                ORDER BY p.Quantity ASC
            `);

        return {
            success: true,
            products: result.recordset
        };
    } catch (error) {
        console.error('Error fetching low stock products:', error);
        return {
            success: false,
            message: 'Failed to fetch low stock products'
        };
    }
});

ipcMain.handle('admin:changePassword', async (event, { currentPassword, newPassword }) => {
    try {
        const pool = await getAppPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            const verifyResult = await transaction.request()
                .input('currentPass', sql.VarChar(100), currentPassword)
                .query(`
                    SELECT AdminID 
                    FROM Admin 
                    WHERE AdminID = 1 AND Admin_Pass = @currentPass
                `);

            if (verifyResult.recordset.length === 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Current password is incorrect'
                };
            }

            await transaction.request()
                .input('newPass', sql.VarChar(100), newPassword)
                .query(`
                    UPDATE Admin 
                    SET Admin_Pass = @newPass 
                    WHERE AdminID = 1
                `);

            await transaction.commit();
            return {
                success: true,
                message: 'Password updated successfully'
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error changing password:', error);
        return {
            success: false,
            message: error.message || 'Failed to change password'
        };
    }
});

ipcMain.handle('customer:getOrders', async (event, customerId) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT 
                    o.OrderID,
                    o.Order_Date,
                    o.Amount,
                    o.Status,
                    o.Shipping_Address,
                    COUNT(oi.ProductID) as ItemCount
                FROM "Order" o
                LEFT JOIN OrderItem oi ON o.OrderID = oi.OrderID
                WHERE o.CustomerID = @customerId
                GROUP BY 
                    o.OrderID,
                    o.Order_Date,
                    o.Amount,
                    o.Status,
                    o.Shipping_Address
                ORDER BY o.Order_Date DESC
            `);

        return {
            success: true,
            orders: result.recordset
        };
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        return {
            success: false,
            message: 'Failed to fetch orders'
        };
    }
});

ipcMain.handle('customer:getOrderDetails', async (event, orderId) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('orderId', sql.Int, orderId)
            .query(`
                SELECT 
                    o.OrderID,
                    o.Order_Date,
                    o.Amount,
                    o.Status,
                    o.Shipping_Address,
                    oi.ProductID,
                    p.Prod_Name,
                    oi.Quantity,
                    oi.Unit_Price,
                    (oi.Quantity * oi.Unit_Price) as ItemTotal
                FROM "Order" o
                JOIN OrderItem oi ON o.OrderID = oi.OrderID
                JOIN Product p ON oi.ProductID = p.ProductID
                WHERE o.OrderID = @orderId
            `);

        return {
            success: true,
            orderDetails: result.recordset
        };
    } catch (error) {
        console.error('Error fetching order details:', error);
        return {
            success: false,
            message: 'Failed to fetch order details'
        };
    }
});

ipcMain.handle('customer:getDashboardStats', async (event, customerId) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM "Order" WHERE CustomerID = @customerId) as TotalOrders,
                    (SELECT COUNT(*) FROM "Order" WHERE CustomerID = @customerId AND Status = 1) as PendingOrders,
                    (SELECT COUNT(*) FROM Voucher WHERE CustomerID = @customerId AND Used = 0 AND Expiry_Date > GETDATE()) as AvailableVouchers,
                    (SELECT ISNULL(SUM(Amount), 0) FROM "Order" WHERE CustomerID = @customerId AND Status != 5) as TotalSpent
            `);

        return {
            success: true,
            stats: result.recordset[0]
        };
    } catch (error) {
        console.error('Error fetching customer dashboard stats:', error);
        return {
            success: false,
            message: 'Failed to fetch dashboard statistics'
        };
    }
});

ipcMain.handle('customer:getFeaturedProducts', async () => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 8
                    p.ProductID,
                    p.Prod_Name,
                    p.Prod_Price,
                    p.Quantity,
                    c.Category_Name,
                    ISNULL((
                        SELECT SUM(oi.Quantity)
                        FROM OrderItem oi
                        JOIN "Order" o ON oi.OrderID = o.OrderID
                        WHERE oi.ProductID = p.ProductID
                        AND o.Status != 5
                    ), 0) as TotalSold
                FROM Product p
                JOIN Category c ON p.CategoryID = c.CategoryID
                WHERE p.Quantity > 0
                ORDER BY TotalSold DESC, p.Prod_Name
            `);

        return {
            success: true,
            products: result.recordset
        };
    } catch (error) {
        console.error('Error fetching featured products:', error);
        return {
            success: false,
            message: 'Failed to fetch featured products'
        };
    }
});

ipcMain.handle('customer:getRecentOrders', async (event, customerId) => {
    try {
        const pool = await getAppPool();
        const result = await pool.request()
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT TOP 5
                    o.OrderID,
                    o.Order_Date,
                    o.Amount,
                    o.Status,
                    COUNT(oi.ProductID) as ItemCount
                FROM "Order" o
                LEFT JOIN OrderItem oi ON o.OrderID = oi.OrderID
                WHERE o.CustomerID = @customerId
                GROUP BY 
                    o.OrderID,
                    o.Order_Date,
                    o.Amount,
                    o.Status
                ORDER BY o.Order_Date DESC
            `);

        return {
            success: true,
            orders: result.recordset
        };
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        return {
            success: false,
            message: 'Failed to fetch recent orders'
        };
    }
});
