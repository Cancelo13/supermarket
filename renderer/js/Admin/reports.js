let charts = {};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Starting to load reports page...');
        const userResult = await loadCurrentUser();
        console.log('User loaded:', userResult);
        
        setupEventListeners();
        console.log('Event listeners set up');
        
        await loadInitialReport();
        console.log('Initial report loaded');
    } catch (error) {
        console.error('Error during page initialization:', error);
        showAlert('danger', 'Failed to initialize reports page. Please refresh and try again.');
    }
});

async function loadCurrentUser() {
    try {
        const result = await window.api.getCurrentUser();
        console.log('Current user result:', result);
        
        if (!result.success || result.user.role !== 'admin') {
            console.log('User not authorized, redirecting...');
            window.api.redirectTo('../index.html');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error loading user:', error);
        window.api.redirectTo('../index.html');
        return false;
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });

    document.getElementById('printReportBtn').addEventListener('click', printCurrentReport);

    document.getElementById('compareCategoriesBtn').addEventListener('click', loadCategoryComparison);

    document.getElementById('generateProductCustomersBtn').addEventListener('click', loadProductCustomers);

    document.getElementById('sendVoucherBtn').addEventListener('click', sendVoucher);

    loadCategories();

    loadProductDropdown();

    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', async (e) => {
            const tabLink = e.target.closest('a,[data-bs-toggle="tab"]');
            const target = tabLink.getAttribute('data-bs-target') || tabLink.getAttribute('href');
            console.log('Tab switched!', target);
            console.log('Event target:', e.target);
            console.log('Tab link:', tabLink);
            console.log('Target attribute:', target);
            switch (target) {
                case '#needs-restock':
                    await loadNeedsRestockReport();
                    break;
                case '#never-bought':
                    await loadNeverBoughtReport();
                    break;
                case '#most-bought':
                    await loadMostBoughtReport();
                    break;
                case '#product-customers':
                    await loadProductCustomers();
                    break;
                case '#inactive-customers':
                    await loadInactiveCustomers();
                    break;
                case '#top-spender':
                    await loadTopSpenders();
                    break;
                case '#category-comparison':
                    if (document.getElementById('category1Selector').value &&
                        document.getElementById('category2Selector').value) {
                        await loadCategoryComparison();
                    }
                    break;
            }
        });
    });

}


async function sendVoucher() {
    const customerId = document.getElementById('emailVoucherCustomerId').value;
    const amount = parseFloat(document.getElementById('emailVoucherValue').value);
    const expiry = document.getElementById('emailVoucherExpiry').value;

    if (!customerId || !amount || !expiry) {
        document.getElementById('emailVoucherAlert').textContent = 'All fields are required!';
        document.getElementById('emailVoucherAlert').classList.remove('d-none');
        return;
    }

    const result = await window.api.callApi('POST', '/voucher/create', {
        customerId: parseInt(customerId),
        amount,
        expiryDate: expiry
    });

    if (result.success) {
        document.getElementById('emailVoucherAlert').classList.add('d-none');
        bootstrap.Modal.getInstance(document.getElementById('emailVoucherModal')).hide();
        showAlert('success', 'Voucher created and assigned!');
    } else {
        document.getElementById('emailVoucherAlert').textContent = result.message || 'Failed to create voucher';
        document.getElementById('emailVoucherAlert').classList.remove('d-none');
    }
}

async function loadInitialReport() {
    try {
        console.log('Loading initial report...');
        await loadNeedsRestockReport();
        console.log('Initial report loaded successfully');

        const firstTab = document.querySelector('[data-bs-toggle="tab"]');
        if (firstTab) {
            const tab = new bootstrap.Tab(firstTab);
            tab.show();
        }
    } catch (error) {
        console.error('Error loading initial report:', error);
        showAlert('danger', 'Failed to load initial report');
    }
}

async function loadCategories() {
    try {
        const result = await window.api.callApi('GET', '/category/getAll');
        if (!result.success) return;

        const options = result.categories.map(c =>
            `<option value="${c.CategoryID}">${c.Category_Name}</option>`
        ).join('');

        document.getElementById('category1Selector').innerHTML += options;
        document.getElementById('category2Selector').innerHTML += options;
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadNeedsRestockReport() {
    try {
        console.log('Fetching needs restock report...');
        const result = await window.api.callApi('GET', '/reports/needsRestock');
        console.log('Needs restock result:', result);

        toggleLoadingState('needsRestock', true);

        if (!result.success) {
            console.error('Failed to load restock report:', result);
            showAlert('danger', 'Failed to load restock report');
            return;
        }

        const { products } = result;
        document.getElementById('needsRestockCount').textContent = products.length;

        if (products.length === 0) {
            toggleEmptyState('needsRestock', true);
            return;
        }

        const tbody = document.getElementById('needsRestockTable');
        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.ProductID}</td>
                <td>${p.Prod_Name}</td>
                <td>${p.Category_Name}</td>
                <td>
                    <span class="badge bg-${p.Quantity <= 10 ? 'danger' : 'warning'}">
                        ${p.Quantity}
                    </span>
                </td>
                <td>${p.Location}</td>
            </tr>
        `).join('');

        toggleLoadingState('needsRestock', false);
        document.getElementById('needsRestockContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading restock report:', error);
        showAlert('danger', 'Failed to load restock report');
        toggleLoadingState('needsRestock', false);
    }
}

async function loadNeverBoughtReport() {
    try {
        toggleLoadingState('neverBought', true);
        document.getElementById('neverBoughtContent').classList.add('d-none');

        const result = await window.api.callApi('GET', '/reports/neverBought');
        console.log('Never Bought API result:', result);

        if (!result.success) {
            toggleLoadingState('neverBought', false);
            showAlert('danger', 'Failed to load never bought report');
            return;
        }

        const { products } = result;
        document.getElementById('neverBoughtCount').textContent = products.length;

        if (products.length === 0) {
            toggleEmptyState('neverBought', true);
            return;
        }

        const tbody = document.getElementById('neverBoughtTable');
        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.ProductID}</td>
                <td>${p.Prod_Name}</td>
                <td>${p.Category_Name}</td>
                <td>$${p.Prod_Price.toFixed(2)}</td>
                <td>${p.Quantity || 0}</td>
            </tr>
        `).join('');

        toggleLoadingState('neverBought', false);
        document.getElementById('neverBoughtContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading never bought report:', error);
        showAlert('danger', 'Failed to load never bought report');
        toggleLoadingState('neverBought', false);
    }
}

async function loadMostBoughtReport() {
    try {
        const result = await window.api.callApi('GET', '/reports/mostBought');

        toggleLoadingState('mostBought', true);

        if (!result.success) {
            showAlert('danger', 'Failed to load most bought report');
            return;
        }

        const { products } = result;
        if (products.length === 0) {
            toggleEmptyState('mostBought', true);
            return;
        }

        const topProduct = products[0];
        document.getElementById('topProductName').textContent = topProduct.Prod_Name;
        document.getElementById('topProductPurchases').textContent = topProduct.TotalPurchases;
        document.getElementById('topProductCustomers').textContent = topProduct.UniqueCustomers;
        document.getElementById('topProductPrice').textContent = topProduct.Prod_Price.toFixed(2);

        const ctx = document.getElementById('mostBoughtChart').getContext('2d');
        if (charts.mostBought) charts.mostBought.destroy();

        charts.mostBought = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: products.slice(0, 10).map(p => p.Prod_Name),
                datasets: [{
                    label: 'Total Purchases',
                    data: products.slice(0, 10).map(p => p.TotalPurchases),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const tbody = document.getElementById('mostBoughtTable');
        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.ProductID}</td>
                <td>${p.Prod_Name}</td>
                <td>$${p.Prod_Price.toFixed(2)}</td>
                <td>${p.TotalPurchases}</td>
                <td>${p.UniqueCustomers}</td>
            </tr>
        `).join('');

        toggleLoadingState('mostBought', false);
        document.getElementById('mostBoughtContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading most bought report:', error);
        showAlert('danger', 'Failed to load most bought report');
    }
}

async function loadProductCustomers() {
    const productSelector = document.getElementById('productSelector');
    const productId = productSelector.value;
    if (!productId) return;

    const selectedOption = productSelector.options[productSelector.selectedIndex];
    document.getElementById('selectedProductName').textContent = selectedOption.text;
    document.getElementById('selectedProductId').textContent = productId;

    try {
        const result = await window.api.callApi('GET', '/reports/productCustomers', { productId });

        toggleLoadingState('productCustomers', true);
        document.getElementById('productCustomersSelect').classList.add('d-none');

        if (!result.success) {
            showAlert('danger', 'Failed to load product customers');
            return;
        }

        const { customers } = result;
        if (customers.length === 0) {
            toggleEmptyState('productCustomers', true);
            return;
        }

        const tbody = document.getElementById('productCustomersTable');
        tbody.innerHTML = customers.map(c => `
            <tr>
                <td>${c.CustomerID}</td>
                <td>${c.Name}</td>
                <td>${c.Email}</td>
                <td>${new Date(c.LastPurchase).toLocaleDateString()}</td>
                <td>${c.OrderCount}</td>
            </tr>
        `).join('');

        toggleLoadingState('productCustomers', false);
        document.getElementById('productCustomersContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading product customers:', error);
        showAlert('danger', 'Failed to load product customers');
    }
}

async function loadInactiveCustomers() {
    try {
        const result = await window.api.callApi('GET', '/reports/inactiveCustomers');

        toggleLoadingState('inactiveCustomers', true);

        if (!result.success) {
            showAlert('danger', 'Failed to load inactive customers');
            return;
        }

        const { customers } = result;
        document.getElementById('inactiveCustomersCount').textContent = customers.length;

        if (customers.length === 0) {
            toggleEmptyState('inactiveCustomers', true);
            return;
        }

        const tbody = document.getElementById('inactiveCustomersTable');
        tbody.innerHTML = customers.map(c => `
            <tr>
                <td>${c.CustomerID}</td>
                <td>${c.Name}</td>
                <td>${c.Email}</td>
                <td>${c.LastOrderDate ? new Date(c.LastOrderDate).toLocaleDateString() : 'Never ordered'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="sendVoucherEmail(${c.CustomerID}, '${c.Name}', '${c.Email}')">
                        <i class="fas fa-ticket-alt me-1"></i>Send Voucher
                    </button>
                </td>
            </tr>
        `).join('');

        toggleLoadingState('inactiveCustomers', false);
        document.getElementById('inactiveCustomersContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading inactive customers:', error);
        showAlert('danger', 'Failed to load inactive customers');
    }
}

async function loadTopSpenders() {
    try {
        const result = await window.api.callApi('GET', '/reports/topSpenders');

        toggleLoadingState('topSpender', true);

        if (!result.success) {
            showAlert('danger', 'Failed to load top spenders');
            return;
        }

        const { customers } = result;
        if (customers.length === 0) {
            toggleEmptyState('topSpender', true);
            return;
        }

        const topSpender = customers[0];
        document.getElementById('topSpenderName').textContent = topSpender.Name;
        document.getElementById('topSpenderAmount').textContent = topSpender.TotalSpent.toFixed(2);
        document.getElementById('topSpenderOrders').textContent = topSpender.OrderCount;

        const ctx = document.getElementById('topSpendersChart').getContext('2d');
        if (charts.topSpenders) charts.topSpenders.destroy();

        charts.topSpenders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: customers.slice(0, 10).map(c => c.Name),
                datasets: [{
                    label: 'Total Spent ($)',
                    data: customers.slice(0, 10).map(c => c.TotalSpent),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const tbody = document.getElementById('topSpendersTable');
        tbody.innerHTML = customers.map(c => `
            <tr>
                <td>${c.CustomerID}</td>
                <td>${c.Name}</td>
                <td>${c.Email}</td>
                <td>${c.OrderCount}</td>
                <td>$${c.TotalSpent.toFixed(2)}</td>
            </tr>
        `).join('');

        toggleLoadingState('topSpenders', false);
        document.getElementById('topSpendersContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading top spenders:', error);
        showAlert('danger', 'Failed to load top spenders');
    }
}

async function loadCategoryComparison() {
    const category1 = document.getElementById('category1Selector').value;
    const category2 = document.getElementById('category2Selector').value;

    if (!category1 || !category2 || category1 === category2) {
        showAlert('warning', 'Please select two different categories');
        return;
    }

    try {
        const result = await window.api.callApi('POST', '/reports/categoryComparison', {
            category1,
            category2
        });
        console.log('Category comparison result:', result);

        toggleLoadingState('categoryComparison', true);
        document.getElementById('categoryComparisonSelect').classList.add('d-none');

        if (!result.success || !result.comparison) {
            showAlert('danger', 'Failed to load category comparison');
            toggleLoadingState('categoryComparison', false);
            return;
        }

        const { summary, details } = result.comparison;
        if (!summary || summary.length === 0) {
            toggleEmptyState('categoryComparison', true);
            toggleLoadingState('categoryComparison', false);
            return;
        }

        const salesCtx = document.getElementById('categorySalesChart').getContext('2d');
        if (charts.categorySales) charts.categorySales.destroy();

        charts.categorySales = new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels: summary.map(c => c.Category_Name),
                datasets: [{
                    label: 'Total Sales',
                    data: summary.map(c => c.TotalSales),
                    backgroundColor: ['rgba(54, 162, 235, 0.5)', 'rgba(255, 99, 132, 0.5)'],
                    borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const revenueCtx = document.getElementById('categoryRevenueChart').getContext('2d');
        if (charts.categoryRevenue) charts.categoryRevenue.destroy();

        charts.categoryRevenue = new Chart(revenueCtx, {
            type: 'bar',
            data: {
                labels: summary.map(c => c.Category_Name),
                datasets: [{
                    label: 'Total Revenue ($)',
                    data: summary.map(c => c.TotalRevenue),
                    backgroundColor: ['rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)'],
                    borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const summaryTbody = document.getElementById('categorySummaryTable');
        summaryTbody.innerHTML = summary.map(c => `
            <tr>
                <td>${c.Category_Name}</td>
                <td>${c.TotalSales}</td>
                <td>$${c.TotalRevenue.toFixed(2)}</td>
                <td>${c.ProductCount}</td>
                <td>${c.AvgSalesPerProduct.toFixed(2)}</td>
            </tr>
        `).join('');

        const detailsTbody = document.getElementById('categoryDetailsTable');
        detailsTbody.innerHTML = details.map(d => `
            <tr>
                <td>${d.Category_Name}</td>
                <td>${d.ProductID}</td>
                <td>${d.Prod_Name}</td>
                <td>${d.TotalSales}</td>
                <td>$${d.TotalRevenue.toFixed(2)}</td>
            </tr>
        `).join('');

        toggleLoadingState('categoryComparison', false);
        document.getElementById('categoryComparisonContent').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading category comparison:', error);
        showAlert('danger', 'Failed to load category comparison');
    }
}

function toggleLoadingState(reportId, show) {
    const loadingEl = document.getElementById(`${reportId}Loading`);
    if (loadingEl) {
        loadingEl.classList.toggle('d-none', !show);
    }
}


function toggleEmptyState(reportId, show) {
    document.getElementById(`${reportId}Loading`).classList.add('d-none');
    document.getElementById(`${reportId}Content`)?.classList.toggle('d-none', show);
    document.getElementById(`${reportId}Empty`)?.classList.toggle('d-none', !show);
}

function sendVoucherEmail(customerId, name, email) {
    document.getElementById('emailVoucherCustomerId').value = customerId;
    document.getElementById('emailVoucherCustomerName').value = name;
    document.getElementById('emailVoucherCustomerEmail').value = email;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('emailVoucherExpiry').min = today;

    const modal = new bootstrap.Modal(document.getElementById('emailVoucherModal'));
    modal.show();
}

async function printCurrentReport() {
    window.print();
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('main').insertAdjacentElement('afterbegin', alertDiv);

    setTimeout(() => alertDiv.remove(), 5000);
}

async function loadProductDropdown() {
    try {
        const result = await window.api.callApi('GET', '/inventory/getAll');
        if (!result.success) return;

        const options = result.inventory.map(p =>
            `<option value="${p.ProductID}">${p.Prod_Name}</option>`
        ).join('');
        document.getElementById('productSelector').innerHTML = '<option value="">Choose a product...</option>' + options;
    } catch (error) {
        console.error('Error loading product dropdown:', error);
    }
}