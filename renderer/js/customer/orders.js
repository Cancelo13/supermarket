let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    await loadOrders();
});

async function loadCurrentUser() {
    try {
        const result = await window.api.getCurrentUser();
        if (!result.success || result.user.role !== 'customer') {
            window.api.redirectTo('../index.html');
            return;
        }
        currentUser = result.user;
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
}

async function loadOrders() {
    try {
        const loadingElement = document.getElementById('loadingOrders');
        const noOrdersMessage = document.getElementById('noOrdersMessage');
        const ordersTableContainer = document.getElementById('ordersTableContainer');

        loadingElement.classList.remove('d-none');
        noOrdersMessage.classList.add('d-none');
        ordersTableContainer.classList.add('d-none');

        const result = await window.api.callApi('GET', '/customer/orders', {
            customerId: currentUser.id
        });

        loadingElement.classList.add('d-none');

        if (!result.success || result.orders.length === 0) {
            noOrdersMessage.classList.remove('d-none');
            return;
        }

        ordersTableContainer.classList.remove('d-none');
        const tbody = document.getElementById('ordersList');
        tbody.innerHTML = result.orders.map(order => `
            <tr>
                <td>#${order.OrderID}</td>
                <td>${new Date(order.Order_Date).toLocaleDateString()}</td>
                <td>$${order.Amount.toFixed(2)}</td>
                <td>${getStatusBadge(order.Status)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewOrderDetails(${order.OrderID})">
                        <i class="fas fa-eye me-1"></i>View Details
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('danger', 'Failed to load orders');
    }
}

async function viewOrderDetails(orderId) {
    try {
        const result = await window.api.callApi('GET', '/customer/order/details', {
            orderId: orderId
        });

        if (!result.success || result.orderDetails.length === 0) {
            showAlert('danger', 'Order not found');
            return;
        }

        const order = result.orderDetails[0];

        document.getElementById('modalOrderId').textContent = `#${order.OrderID}`;
        document.getElementById('modalOrderDate').textContent = new Date(order.Order_Date).toLocaleString();
        document.getElementById('modalOrderStatus').className = `badge ${getStatusBadgeClass(order.Status)}`;
        document.getElementById('modalOrderStatus').textContent = getStatusText(order.Status);
        document.getElementById('modalOrderAmount').textContent = `$${order.Amount.toFixed(2)}`;

        const itemsHtml = result.orderDetails.map(item => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div>
                            <h6 class="mb-0">${item.Prod_Name}</h6>
                            <small class="text-muted">Quantity: ${item.Quantity}</small>
                        </div>
                    </div>
                </td>
                <td>$${item.ItemTotal.toFixed(2)}</td>
            </tr>
        `).join('');

        document.getElementById('modalOrderItems').innerHTML = itemsHtml;

        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading order details:', error);
        showAlert('danger', 'Failed to load order details');
    }
}

function getStatusBadge(status) {
    return `<span class="badge ${getStatusBadgeClass(status)}">${getStatusText(status)}</span>`;
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 1: return 'bg-warning';   // Pending
        case 2: return 'bg-info';      // Processing
        case 3: return 'bg-primary';   // Shipped
        case 4: return 'bg-success';   // Delivered
        case 5: return 'bg-danger';    // Cancelled
        default: return 'bg-secondary';
    }
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

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('main').insertAdjacentElement('afterbegin', alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}