let currentPage = 1;
const pageSize = 10;
let totalOrders = 0;
let orders = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    await loadOrders();
});

async function loadCurrentUser() {
    try {
        const result = await window.api.getCurrentUser();
        if (!result.success || result.user.role !== 'admin') {
            window.api.redirectTo('../index.html');
            return;
        }
    } catch (error) {
        console.error('Error loading user:', error);
        window.api.redirectTo('../index.html');
    }
}

function setupEventListeners() {
    document.getElementById('searchOrders').addEventListener('input', filterOrders);
    document.getElementById('statusFilter').addEventListener('change', filterOrders);
    document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);
    document.getElementById('exportOrdersBtn').addEventListener('click', exportOrders);
    document.getElementById('printOrdersBtn').addEventListener('click', printOrders);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });
}

async function loadOrders() {
    try {
        const result = await window.api.database.executeQuery(`
            SELECT 
                o.OrderID,
                o.CustomerID,
                c.Name as CustomerName,
                o.Order_Date,
                o.Shipping_Address,
                o.Amount,
                o.Status,
                COUNT(oi.ProductID) as ItemCount
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

        if (result.success) {
            orders = result.data;
            totalOrders = orders.length;
            updateOrdersTable(orders);
            updatePagination();
        } else {
            showAlert('danger', 'Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('danger', 'Error loading orders');
    }
}

function updateOrdersTable(ordersToShow) {
    const tableBody = document.getElementById('ordersTableBody');
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginatedOrders = ordersToShow.slice(start, end);

    if (paginatedOrders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No orders found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = paginatedOrders.map(order => `
        <tr>
            <td>#${order.OrderID}</td>
            <td>${order.CustomerName}</td>
            <td>${new Date(order.Order_Date).toLocaleString()}</td>
            <td>$${order.Amount.toFixed(2)}</td>
            <td>
                <span class="badge ${getStatusBadgeClass(order.Status)}">
                    ${getStatusText(order.Status)}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="viewOrderDetails(${order.OrderID})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-primary me-1" onclick="updateOrderStatus(${order.OrderID}, ${order.Status})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="printOrder(${order.OrderID})">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        </tr>
    `).join('');

    document.getElementById('totalOrdersCount').textContent = totalOrders;
}

function updatePagination() {
    const totalPages = Math.ceil(totalOrders / pageSize);
    const pagination = document.getElementById('ordersPagination');

    let paginationHTML = '';

    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
        </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }

    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
        </li>
    `;

    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    if (page < 1 || page > Math.ceil(totalOrders / pageSize)) return;
    currentPage = page;
    updateOrdersTable(orders);
    updatePagination();
}

function filterOrders() {
    const searchTerm = document.getElementById('searchOrders').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = orders;

    if (searchTerm) {
        filtered = filtered.filter(order =>
            order.OrderID.toString().includes(searchTerm) ||
            order.CustomerName.toLowerCase().includes(searchTerm)
        );
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(order =>
            getStatusText(order.Status).toLowerCase() === statusFilter
        );
    }

    currentPage = 1;
    updateOrdersTable(filtered);
    updatePagination();
}

async function viewOrderDetails(orderId) {
    try {
        const result = await window.api.database.executeQuery(`
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
                (oi.Quantity * oi.Unit_Price) as ItemTotal
            FROM "Order" o
            JOIN Customer c ON o.CustomerID = c.CustomerID
            JOIN OrderItem oi ON o.OrderID = oi.OrderID
            JOIN Product p ON oi.ProductID = p.ProductID
            WHERE o.OrderID = @param0
        `, [orderId]);

        if (result.success && result.data.length > 0) {
            const order = result.data[0];
            const items = result.data;

            document.getElementById('orderDetailsContent').innerHTML = `
                <div class="row mb-3">
                    <div class="col-md-6">
                        <h6>Order Information</h6>
                        <p><strong>Order ID:</strong> #${order.OrderID}</p>
                        <p><strong>Date:</strong> ${new Date(order.Order_Date).toLocaleString()}</p>
                        <p><strong>Status:</strong> 
                            <span class="badge ${getStatusBadgeClass(order.Status)}">
                                ${getStatusText(order.Status)}
                            </span>
                        </p>
                    </div>
                    <div class="col-md-6">
                        <h6>Customer Information</h6>
                        <p><strong>Name:</strong> ${order.CustomerName}</p>
                        <p><strong>Email:</strong> ${order.CustomerEmail}</p>
                        <p><strong>Shipping Address:</strong> ${order.Shipping_Address}</p>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>${item.Prod_Name}</td>
                                    <td>${item.Quantity}</td>
                                    <td>$${item.Unit_Price.toFixed(2)}</td>
                                    <td>$${item.ItemTotal.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            <tr>
                                <td colspan="3" class="text-end"><strong>Total Amount:</strong></td>
                                <td><strong>$${order.Amount.toFixed(2)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading order details:', error);
        showAlert('danger', 'Error loading order details');
    }
}

async function updateOrderStatus(orderId, currentStatus) {
    document.getElementById('orderIdInput').value = orderId;
    document.getElementById('orderStatusSelect').value = getStatusText(currentStatus).toLowerCase();

    const modal = new bootstrap.Modal(document.getElementById('updateOrderStatusModal'));
    modal.show();

    document.getElementById('saveStatusBtn').onclick = async () => {
        try {
            const newStatus = document.getElementById('orderStatusSelect').value;
            const notes = document.getElementById('statusNotes').value;

            const statusMap = {
                'pending': 1,
                'processing': 2,
                'shipped': 3,
                'delivered': 4,
                'cancelled': 5
            };

            const result = await window.api.database.executeQuery(`
                UPDATE "Order"
                SET Status = @param1
                WHERE OrderID = @param0
            `, [orderId, statusMap[newStatus]]);

            if (result.success) {
                modal.hide();
                await loadOrders();
                showAlert('success', 'Order status updated successfully');
            } else {
                document.getElementById('statusUpdateAlert').textContent = 'Failed to update order status';
                document.getElementById('statusUpdateAlert').classList.remove('d-none');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            document.getElementById('statusUpdateAlert').textContent = 'Error updating order status';
            document.getElementById('statusUpdateAlert').classList.remove('d-none');
        }
    };
}

function getStatusText(status) {
    switch (status) {
        case 1: return 'Pending';
        case 2: return 'Processing';
        case 3: return 'Shipped';
        case 4: return 'Delivered';
        case 5: return 'Cancelled';
        default: return 'Unknown';
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 1: return 'bg-warning';
        case 2: return 'bg-info';
        case 3: return 'bg-primary';
        case 4: return 'bg-success';
        case 5: return 'bg-danger';
        default: return 'bg-secondary';
    }
}

function exportOrders() {
    const filteredOrders = Array.from(document.getElementById('ordersTableBody').getElementsByTagName('tr'))
        .map(row => ({
            'Order ID': row.cells[0].textContent,
            'Customer': row.cells[1].textContent,
            'Date': row.cells[2].textContent,
            'Amount': row.cells[3].textContent,
            'Status': row.cells[4].textContent.trim()
        }));

    const csv = convertToCSV(filteredOrders);
    downloadCSV(csv, 'orders_export.csv');
}

function convertToCSV(arr) {
    const array = [Object.keys(arr[0])].concat(arr);
    return array.map(row =>
        Object.values(row).map(value =>
            `"${value}"`
        ).join(',')
    ).join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function printOrders() {
    window.print();
}

function showAlert(type, message) {
    const alertsContainer = document.getElementById('alertsContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertsContainer.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}