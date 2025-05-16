/*==============================================================*/
/* DBMS name:      Microsoft SQL Server 2012                    */
/* Created on:     5/14/2025 7:11:16 PM                         */
/*==============================================================*/


if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('Inventory') and o.name = 'FK_INVENTOR_MANAGED B_ADMIN')
alter table Inventory
   drop constraint "FK_INVENTOR_MANAGED B_ADMIN"



if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('"Order"') and o.name = 'FK_ORDER_PLACES_CUSTOMER')
alter table "Order"
   drop constraint FK_ORDER_PLACES_CUSTOMER



if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('OrderItem') and o.name = 'FK_ORDERITE_ORDERITEM_PRODUCT')
alter table OrderItem
   drop constraint FK_ORDERITE_ORDERITEM_PRODUCT



if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('OrderItem') and o.name = 'FK_ORDERITE_ORDERITEM_ORDER')
alter table OrderItem
   drop constraint FK_ORDERITE_ORDERITEM_ORDER



if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('Product') and o.name = 'FK_PRODUCT_BELONG_CATEGORY')
alter table Product
   drop constraint FK_PRODUCT_BELONG_CATEGORY



if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('Product') and o.name = 'FK_PRODUCT_RECORD_INVENTOR')
alter table Product
   drop constraint FK_PRODUCT_RECORD_INVENTOR



if exists (select 1
   from sys.sysreferences r join sys.sysobjects o on (o.id = r.constid and o.type = 'F')
   where r.fkeyid = object_id('Voucher') and o.name = 'FK_VOUCHER_REFERENCE_CUSTOMER')
alter table Voucher
   drop constraint FK_VOUCHER_REFERENCE_CUSTOMER



if exists (select 1
            from  sysobjects
           where  id = object_id('Admin')
            and   type = 'U')
   drop table Admin



if exists (select 1
            from  sysobjects
           where  id = object_id('Category')
            and   type = 'U')
   drop table Category



if exists (select 1
            from  sysobjects
           where  id = object_id('Customer')
            and   type = 'U')
   drop table Customer



if exists (select 1
            from  sysindexes
           where  id    = object_id('Inventory')
            and   name  = 'Managed By_FK'
            and   indid > 0
            and   indid < 255)
   drop index Inventory."Managed By_FK"



if exists (select 1
            from  sysobjects
           where  id = object_id('Inventory')
            and   type = 'U')
   drop table Inventory



if exists (select 1
            from  sysindexes
           where  id    = object_id('"Order"')
            and   name  = 'Places_FK'
            and   indid > 0
            and   indid < 255)
   drop index "Order".Places_FK



if exists (select 1
            from  sysobjects
           where  id = object_id('"Order"')
            and   type = 'U')
   drop table "Order"



if exists (select 1
            from  sysindexes
           where  id    = object_id('OrderItem')
            and   name  = 'refers to_FK'
            and   indid > 0
            and   indid < 255)
   drop index OrderItem."refers to_FK"



if exists (select 1
            from  sysindexes
           where  id    = object_id('OrderItem')
            and   name  = 'Order_FK'
            and   indid > 0
            and   indid < 255)
   drop index OrderItem.Order_FK



if exists (select 1
            from  sysobjects
           where  id = object_id('OrderItem')
            and   type = 'U')
   drop table OrderItem



if exists (select 1
            from  sysindexes
           where  id    = object_id('Product')
            and   name  = 'Record2_FK'
            and   indid > 0
            and   indid < 255)
   drop index Product.Record2_FK



if exists (select 1
            from  sysindexes
           where  id    = object_id('Product')
            and   name  = 'Belong_FK'
            and   indid > 0
            and   indid < 255)
   drop index Product.Belong_FK



if exists (select 1
            from  sysobjects
           where  id = object_id('Product')
            and   type = 'U')
   drop table Product



if exists (select 1
            from  sysobjects
           where  id = object_id('Voucher')
            and   type = 'U')
   drop table Voucher



/*==============================================================*/
/* Table: Admin                                                 */
/*==============================================================*/
create table Admin (
   AdminID              int                  not null,
   Admin_Name           varchar(100)         not null,
   Admin_Pass           varchar(100)         not null,
   constraint PK_ADMIN primary key nonclustered (AdminID)
)



/*==============================================================*/
/* Table: Category                                              */
/*==============================================================*/
create table Category (
   CategoryID           int                  not null,
   Category_Name        varchar(100)         not null,
   constraint PK_CATEGORY primary key nonclustered (CategoryID)
)



/*==============================================================*/
/* Table: Customer                                              */
/*==============================================================*/
create table Customer (
   CustomerID           int                  not null,
   Name                 varchar(50)          not null,
   Email                varchar(50)          null,
   Password             varchar(100)         not null,
   Address              varchar(50)          null,
   constraint PK_CUSTOMER primary key nonclustered (CustomerID)
)



/*==============================================================*/
/* Table: Inventory                                             */
/*==============================================================*/
create table Inventory (
   InventoryID          int                  not null,
   AdminID              int                  not null,
   Quantity             int                  not null,
   Location             varchar(100)         not null,
   constraint PK_INVENTORY primary key nonclustered (InventoryID)
)



/*==============================================================*/
/* Index: "Managed By_FK"                                       */
/*==============================================================*/
create index "Managed By_FK" on Inventory (
AdminID ASC
)



/*==============================================================*/
/* Table: "Order"                                               */
/*==============================================================*/
create table "Order" (
   OrderID              int                  not null,
   CustomerID           int                  not null,
   OrderDate            datetime            not null,
   Shipping_Address     varchar(255)         not null,
   Amount              decimal(10,2)        not null,
   Status              int                  not null, 
   constraint PK_ORDER primary key nonclustered (OrderID)
)


/*==============================================================*/
/* Index: Places_FK                                             */
/*==============================================================*/
create index Places_FK on "Order" (
CustomerID ASC
)



/*==============================================================*/
/* Table: OrderItem                                             */
/*==============================================================*/
create table OrderItem (
   ProductID            int                  not null,
   OrderID              int                  not null,
   constraint PK_ORDERITEM primary key nonclustered (ProductID, OrderID)
)



/*==============================================================*/
/* Index: Order_FK                                              */
/*==============================================================*/
create index Order_FK on OrderItem (
OrderID ASC
)



/*==============================================================*/
/* Index: "refers to_FK"                                        */
/*==============================================================*/
create index "refers to_FK" on OrderItem (
ProductID ASC
)



/*==============================================================*/
/* Table: Product                                               */
/*==============================================================*/
create table Product (
   ProductID            int                  not null,
   CategoryID           int                  not null,
   InventoryID          int                  not null,
   Prod_Name            varchar(100)         not null,
   Prod_Price           int                  not null,
   Quantity             int                  not null,
   constraint PK_PRODUCT primary key nonclustered (ProductID)
)



/*==============================================================*/
/* Index: Belong_FK                                             */
/*==============================================================*/
create index Belong_FK on Product (
CategoryID ASC
)



/*==============================================================*/
/* Index: Record2_FK                                            */
/*==============================================================*/
create index Record2_FK on Product (
InventoryID ASC
)



/*==============================================================*/
/* Table: Voucher                                               */
/*==============================================================*/
create table Voucher (
   VoucherCode          int                  not null,
   CustomerID           int                  null,
   Value                int                  not null,
   ExpiryDate           datetime             not null,
   constraint PK_VOUCHER primary key nonclustered (VoucherCode)
)



alter table Inventory
   add constraint "FK_INVENTOR_MANAGED B_ADMIN" foreign key (AdminID)
      references Admin (AdminID)



alter table "Order"
   add constraint FK_ORDER_PLACES_CUSTOMER foreign key (CustomerID)
      references Customer (CustomerID)



alter table OrderItem
   add constraint FK_ORDERITE_ORDERITEM_PRODUCT foreign key (ProductID)
      references Product (ProductID)



alter table OrderItem
   add constraint FK_ORDERITE_ORDERITEM_ORDER foreign key (OrderID)
      references "Order" (OrderID)



alter table Product
   add constraint FK_PRODUCT_BELONG_CATEGORY foreign key (CategoryID)
      references Category (CategoryID)



alter table Product
   add constraint FK_PRODUCT_RECORD_INVENTOR foreign key (InventoryID)
      references Inventory (InventoryID)



alter table Voucher
   add constraint FK_VOUCHER_REFERENCE_CUSTOMER foreign key (CustomerID)
      references Customer (CustomerID)

