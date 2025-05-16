let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    await loadDashboardData();
    updateCartBadge();
});

async function loadCurrentUser() {
    try {
        const result = await window.api.getCurrentUser();
        if (!result.success || result.user.role !== 'customer') {
            window.api.redirectTo('../index.html');
            return;
        }
        currentUser = result.user;
        document.getElementById('customerName').textContent = currentUser.name;
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

async function loadDashboardData() {
    try {
        await Promise.all([
            loadDashboardStats(),
            loadFeaturedProducts(),
            loadRecentOrders()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('danger', 'Failed to load dashboard data');
    }
}

async function loadDashboardStats() {
    try {
        const result = await window.api.callApi('GET', '/customer/dashboard/stats', {
            customerId: currentUser.id
        });

        if (!result.success || !result.stats) {
            showAlert('danger', 'Failed to load dashboard statistics');
            return;
        }

        const elements = {
            totalOrders: document.getElementById('totalOrders'),
            pendingOrders: document.getElementById('pendingOrders'),
            availableVouchers: document.getElementById('availableVouchers'),
            totalSpent: document.getElementById('totalSpent')
        };

        if (elements.totalOrders) {
            elements.totalOrders.textContent = result.stats.TotalOrders || 0;
        }
        if (elements.pendingOrders) {
            elements.pendingOrders.textContent = result.stats.PendingOrders || 0;
        }
        if (elements.availableVouchers) {
            elements.availableVouchers.textContent = result.stats.AvailableVouchers || 0;
        }
        if (elements.totalSpent) {
            elements.totalSpent.textContent = `$${(result.stats.TotalSpent || 0).toFixed(2)}`;
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showAlert('danger', 'Failed to load dashboard statistics');
    }
}

async function loadFeaturedProducts() {
    try {
        const result = await window.api.callApi('GET', '/customer/dashboard/featuredProducts');

        const loadingElement = document.getElementById('loadingProducts');
        const productsContainer = document.getElementById('featuredProducts');

        if (!result.success) {
            loadingElement.textContent = 'Failed to load products';
            return;
        }

        loadingElement.remove();
        productsContainer.innerHTML = result.products.map(product => `
            <div class="col-md-3 mb-4">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${product.Prod_Name}</h5>
                        <p class="card-text text-muted">${product.Category_Name}</p>
                        <p class="card-text">
                            <span class="h5 text-primary">$${product.Prod_Price.toFixed(2)}</span>
                        </p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="badge bg-${product.Quantity > 20 ? 'success' : 'warning'}">
                                ${product.Quantity} in stock
                            </span>
                            <button class="btn btn-primary btn-sm" onclick="addToCart(${product.ProductID}, '${product.Prod_Name}', ${product.Prod_Price})">
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading featured products:', error);
        showAlert('danger', 'Failed to load featured products');
    }
}

async function loadRecentOrders() {
    try {
        const result = await window.api.callApi('GET', '/customer/dashboard/recentOrders', {
            customerId: currentUser.id
        });

        const tbody = document.getElementById('recentOrders');

        if (!result.success) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load orders</td></tr>';
            return;
        }

        if (result.orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No orders found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = result.orders.map(order => `
            <tr>
                <td>#${order.OrderID}</td>
                <td>${new Date(order.Order_Date).toLocaleDateString()}</td>
                <td>$${order.Amount.toFixed(2)}</td>
                <td>${getStatusBadge(order.Status)}</td>
                <td>
                    <a href="orders.html?id=${order.OrderID}" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> View
                    </a>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading recent orders:', error);
        showAlert('danger', 'Failed to load recent orders');
    }
}
function getStatusBadge(status) {
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

function addToCart(productId, name, price) {
    try {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');

        const existingItem = cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({
                productId,
                name,
                price,
                quantity: 1
            });
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        showAlert('success', `${name} added to cart`);
    } catch (error) {
        console.error('Error adding to cart:', error);
        showAlert('danger', 'Failed to add item to cart');
    }
}

function updateCartBadge() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        const badges = document.querySelectorAll('#cartBadge, #cartCount');
        badges.forEach(badge => {
            badge.textContent = totalItems;
            badge.style.display = totalItems > 0 ? 'inline' : 'none';
        });
    } catch (error) {
        console.error('Error updating cart badge:', error);
    }
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const mainContent = document.querySelector('main');
    mainContent.insertAdjacentElement('afterbegin', alertDiv);

    setTimeout(() => alertDiv.remove(), 3000);
}