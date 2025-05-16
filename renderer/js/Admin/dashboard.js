let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    await loadDashboardData();
});

async function loadCurrentUser() {
    try {
        const result = await window.api.getCurrentUser();
        if (!result.success || result.user.role !== 'admin') {
            window.api.redirectTo('../index.html');
            return;
        }
        currentUser = result.user;
        document.getElementById('adminName').textContent = currentUser.name;
    } catch (error) {
        console.error('Error loading user:', error);
        window.api.redirectTo('../index.html');
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });

    document.getElementById('logoutLink').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });

    document.getElementById('savePasswordBtn').addEventListener('click', changePassword);
}

async function loadDashboardData() {
    try {
        const statsResult = await window.api.callApi('GET', '/dashboard/getSummaryStats');
        if (statsResult.success) {
            document.getElementById('totalProducts').textContent = statsResult.stats.TotalProducts;
            document.getElementById('totalCategories').textContent = statsResult.stats.TotalCategories;
            document.getElementById('totalCustomers').textContent = statsResult.stats.TotalCustomers;
            document.getElementById('totalOrders').textContent = statsResult.stats.TotalOrders;
            updateAlerts(statsResult.stats);
        }

        const ordersResult = await window.api.callApi('GET', '/dashboard/getRecentOrders');
        if (ordersResult.success && ordersResult.orders) {
            const tbody = document.getElementById('recentOrders');
            tbody.innerHTML = ordersResult.orders.map(order => `
                <tr>
                    <td>#${order.OrderID}</td>
                    <td>${order.CustomerName}</td>
                    <td>$${order.Amount.toFixed(2)}</td>
                    <td>${getOrderStatusBadge(order.Status)}</td>
                </tr>
            `).join('');
        }

        const productsResult = await window.api.callApi('GET', '/dashboard/getTopProducts');
        if (productsResult.success && productsResult.products) {
            const tbody = document.getElementById('topProducts');
            tbody.innerHTML = productsResult.products.map(product => `
                <tr>
                    <td>${product.Prod_Name}</td>
                    <td>$${product.Prod_Price.toFixed(2)}</td>
                    <td>${product.TotalSold} units</td>
                </tr>
            `).join('');
        }

        const lowStockResult = await window.api.callApi('GET', '/dashboard/getLowStockProducts');
        if (lowStockResult.success && lowStockResult.products) {
            const tbody = document.getElementById('lowStockProducts');
            tbody.innerHTML = lowStockResult.products.map(product => `
                <tr>
                    <td>#${product.ProductID}</td>
                    <td>${product.Prod_Name}</td>
                    <td>${product.Category_Name}</td>
                    <td>${product.Quantity}</td>
                    <td>${product.Location}</td>
                </tr>
            `).join('');

            if (lowStockResult.products.length > 0) {
                document.getElementById('lowStockAlert')?.classList.remove('d-none');
                document.getElementById('lowStockCount').textContent = lowStockResult.products.length;
            }
        }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('danger', 'Failed to load some dashboard data');
    }
}

async function loadSummaryStats() {
    const result = await window.api.database.executeQuery(`
        SELECT 
            (SELECT COUNT(*) FROM Product) as TotalProducts,
            (SELECT COUNT(*) FROM Category) as TotalCategories,
            (SELECT COUNT(*) FROM Customer) as TotalCustomers,
            (SELECT COUNT(*) FROM "Order") as TotalOrders,
            (SELECT COUNT(*) FROM "Order" WHERE Status = 1) as PendingOrders,
            (SELECT SUM(Amount) FROM "Order" WHERE Status != 5) as TotalRevenue,
            (SELECT COUNT(*) FROM Product WHERE Quantity <= 20) as LowStockCount
    `);

    return result.data[0];
}

async function loadRecentOrders() {
    const result = await window.api.database.executeQuery(`
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

    return result.data;
}

async function loadTopProducts() {
    const result = await window.api.database.executeQuery(`
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

    return result.data;
}

async function loadLowStockProducts() {
    const result = await window.api.database.executeQuery(`
        SELECT TOP 5
            p.ProductID,
            p.Prod_Name,
            c.Category_Name,
            p.Prod_Price,
            p.Quantity,
            i.Location
        FROM Product p
        JOIN Category c ON p.CategoryID = c.CategoryID
        JOIN Inventory i ON p.InventoryID = i.InventoryID
        WHERE p.Quantity <= 20
        ORDER BY p.Quantity ASC
    `);

    return result.data;
}

function updateSummaryCards(stats) {
    document.getElementById('totalProducts').textContent = stats.TotalProducts;
    document.getElementById('totalCategories').textContent = stats.TotalCategories;
    document.getElementById('totalCustomers').textContent = stats.TotalCustomers;
    document.getElementById('totalOrders').textContent = stats.TotalOrders;
}

function updateRecentOrders(orders) {
    const tbody = document.getElementById('recentOrders');
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.OrderID}</td>
            <td>${order.CustomerName}</td>
            <td>$${order.Amount.toFixed(2)}</td>
            <td>${getOrderStatusBadge(order.Status)}</td>
        </tr>
    `).join('');
}

function updateTopProducts(products) {
    const tbody = document.getElementById('topProducts');
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.Prod_Name}</td>
            <td>$${product.Prod_Price.toFixed(2)}</td>
            <td>${product.TotalSold} units</td>
        </tr>
    `).join('');
}

function updateLowStockProducts(products) {
    const tbody = document.getElementById('lowStockProducts');
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>#${product.ProductID}</td>
            <td>${product.Prod_Name}</td>
            <td>${product.Category_Name}</td>
            <td>$${product.Prod_Price.toFixed(2)}</td>
            <td>
                <span class="badge ${product.Quantity <= 10 ? 'bg-danger' : 'bg-warning'}">
                    ${product.Quantity}
                </span>
            </td>
            <td>${product.Location}</td>
        </tr>
    `).join('');
}

function updateAlerts(stats) {
    const lowStockAlert = document.getElementById('lowStockAlert');
    const lowStockCount = document.getElementById('lowStockCount');
    if (stats.LowStockCount > 0) {
        lowStockAlert?.classList.remove('d-none');
        if (lowStockCount) lowStockCount.textContent = stats.LowStockCount;
    }

    const pendingOrdersAlert = document.getElementById('pendingOrdersAlert');
    const pendingOrdersCount = document.getElementById('pendingOrdersCount');
    if (stats.PendingOrders > 0) {
        pendingOrdersAlert?.classList.remove('d-none');
        if (pendingOrdersCount) pendingOrdersCount.textContent = stats.PendingOrders;
    }
}

function getOrderStatusBadge(status) {
    const statusMap = {
        1: ['bg-warning', 'Pending'],
        2: ['bg-info', 'Processing'],
        3: ['bg-primary', 'Shipped'],
        4: ['bg-success', 'Delivered'],
        5: ['bg-danger', 'Cancelled']
    };

    const [bgClass, text] = statusMap[status] || ['bg-secondary', 'Unknown'];
    return `<span class="badge ${bgClass}">${text}</span>`;
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const alertElement = document.getElementById('passwordAlert');

    if (newPassword !== confirmPassword) {
        alertElement.textContent = 'New passwords do not match';
        alertElement.classList.remove('d-none');
        return;
    }

    try {
        const result = await window.api.database.executeQuery(`
            UPDATE Admin 
            SET Admin_Pass = @newPass 
            WHERE AdminID = @adminId AND Admin_Pass = @currentPass
        `, [newPassword, currentUser.id, currentPassword]);

        if (result.rowsAffected[0] > 0) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
            modal.hide();
            showAlert('success', 'Password changed successfully');
        } else {
            alertElement.textContent = 'Current password is incorrect';
            alertElement.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alertElement.textContent = 'Failed to change password';
        alertElement.classList.remove('d-none');
    }
}

function showAlert(type, message) {
    const alertsContainer = document.getElementById('alertsContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertsContainer.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const alertElement = document.getElementById('passwordAlert');

    alertElement.textContent = '';
    alertElement.classList.add('d-none');

    if (!currentPassword || !newPassword || !confirmPassword) {
        alertElement.textContent = 'All fields are required';
        alertElement.classList.remove('d-none');
        return;
    }

    if (newPassword !== confirmPassword) {
        alertElement.textContent = 'New passwords do not match';
        alertElement.classList.remove('d-none');
        return;
    }

    if (newPassword.length < 6) {
        alertElement.textContent = 'New password must be at least 6 characters';
        alertElement.classList.remove('d-none');
        return;
    }

    try {
        const result = await window.api.callApi('POST', '/admin/changePassword', {
            currentPassword,
            newPassword
        });

        if (result.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
            modal.hide();
            showAlert('success', 'Password changed successfully');

            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            alertElement.textContent = result.message;
            alertElement.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alertElement.textContent = 'Failed to change password';
        alertElement.classList.remove('d-none');
    }
}