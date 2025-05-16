IF NOT EXISTS (
    SELECT * 
    FROM sys.indexes 
    WHERE name='UQ_Product_Name' AND object_id = OBJECT_ID('Product')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Product_Name
    ON Product (Prod_Name)
    WHERE Prod_Name IS NOT NULL;
END

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE referenced_object_id = object_id('"Order"'))
BEGIN
    DECLARE @sql NVARCHAR(MAX) = ''
    SELECT @sql += 'ALTER TABLE ' + OBJECT_SCHEMA_NAME(parent_object_id) +
        '.[' + OBJECT_NAME(parent_object_id) + '] ' +
        'DROP CONSTRAINT [' + name + ']' + CHAR(13)
    FROM sys.foreign_keys
    WHERE referenced_object_id = object_id('"Order"')
    EXEC sp_executesql @sql
END

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND type in (N'U'))
DROP TABLE [dbo].[Order]

CREATE TABLE [dbo].[Order] (
    OrderID              INT                  NOT NULL,
    CustomerID           INT                  NOT NULL,
    Order_Date           DATETIME            NOT NULL,
    Shipping_Address     VARCHAR(255)         NOT NULL,
    Amount              DECIMAL(10,2)        NOT NULL,
    Status              INT                  NOT NULL, -- 1=Pending, 2=Processing, 3=Completed, 4=Cancelled
    CONSTRAINT PK_ORDER PRIMARY KEY (OrderID),
    CONSTRAINT FK_ORDER_CUSTOMER FOREIGN KEY (CustomerID) 
        REFERENCES Customer(CustomerID)
)

CREATE INDEX IX_Order_CustomerID ON [Order](CustomerID)
CREATE INDEX IX_Order_Status ON [Order](Status)


IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OrderItem]') AND type in (N'U'))
DROP TABLE [dbo].[OrderItem]

CREATE TABLE [dbo].[OrderItem] (
    OrderID              INT                  NOT NULL,
    ProductID            INT                  NOT NULL,
    Quantity            INT                  NOT NULL,
    Unit_Price          DECIMAL(10,2)        NOT NULL,
    CONSTRAINT PK_ORDERITEM PRIMARY KEY (OrderID, ProductID),
    CONSTRAINT FK_ORDERITEM_ORDER FOREIGN KEY (OrderID) 
        REFERENCES [Order](OrderID),
    CONSTRAINT FK_ORDERITEM_PRODUCT FOREIGN KEY (ProductID) 
        REFERENCES Product(ProductID)
)

CREATE INDEX IX_OrderItem_OrderID ON OrderItem(OrderID)
CREATE INDEX IX_OrderItem_ProductID ON OrderItem(ProductID)
