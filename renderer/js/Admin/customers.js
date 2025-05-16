document.addEventListener('DOMContentLoaded', async () => {
    await loadCustomers();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterCustomers);
    document.getElementById('sortOptions').addEventListener('change', filterCustomers);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    document.getElementById('saveCustomerBtn').addEventListener('click', addCustomer);

    document.getElementById('updateCustomerBtn').addEventListener('click', updateCustomer);

    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('login.html');
    });
}

async function loadCustomers() {
    try {
        const result = await window.api.callApi('GET', '/customer/getAll');
        if (result.success) {
            updateCustomersTable(result.customers);
        } else {
            showAlert('danger', 'Failed to load customers');
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        showAlert('danger', 'Error loading customers');
    }
}

function updateCustomersTable(customers) {
    const tableBody = document.getElementById('customersTableBody');
    const noCustomersMessage = document.getElementById('noCustomersMessage');

    if (customers && customers.length > 0) {
        tableBody.innerHTML = customers.map(customer => `
            <tr>
                <td>${customer.CustomerID}</td>
                <td>${customer.Name}</td>
                <td>${customer.Email || 'N/A'}</td>
                <td>${customer.Address || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="editCustomer(${customer.CustomerID})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger me-2" onclick="deleteCustomer(${customer.CustomerID})">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="viewCustomerOrders(${customer.CustomerID}, '${customer.Name}')">
                        <i class="fas fa-clipboard-list"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        noCustomersMessage.classList.add('d-none');
    } else {
        tableBody.innerHTML = '';
        noCustomersMessage.classList.remove('d-none');
    }
}

async function addCustomer() {
    const customerData = {
        name: document.getElementById('customerName').value,
        email: document.getElementById('customerEmail').value,
        password: document.getElementById('customerPassword').value,
        address: document.getElementById('customerAddress').value
    };

    try {
        const saveBtn = document.getElementById('saveCustomerBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Adding...';

        const result = await window.api.callApi('POST', '/customer/add', customerData);

        if (result.success) {
            showAlert('success', 'Customer added successfully');
            document.getElementById('addCustomerForm').reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCustomerModal'));
            modal.hide();
            await loadCustomers();
        } else {
            showAlert('danger', result.message || 'Failed to add customer');
        }
    } catch (error) {
        console.error('Error adding customer:', error);
        showAlert('danger', 'Error adding customer');
    } finally {
        const saveBtn = document.getElementById('saveCustomerBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Add Customer';
    }
}

async function filterCustomers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sortOption = document.getElementById('sortOptions').value;

    try {
        const result = await window.api.callApi('GET', '/customer/getAll');

        if (result.success) {
            let filteredCustomers = result.customers;

            if (searchTerm) {
                filteredCustomers = filteredCustomers.filter(customer =>
                    customer.Name.toLowerCase().includes(searchTerm) ||
                    (customer.Email && customer.Email.toLowerCase().includes(searchTerm))
                );
            }

            filteredCustomers.sort((a, b) => {
                switch (sortOption) {
                    case 'name_asc':
                        return a.Name.localeCompare(b.Name);
                    case 'name_desc':
                        return b.Name.localeCompare(a.Name);
                    case 'id_asc':
                        return a.CustomerID - b.CustomerID;
                    case 'id_desc':
                        return b.CustomerID - a.CustomerID;
                    default:
                        return 0;
                }
            });

            updateCustomersTable(filteredCustomers);
        }
    } catch (error) {
        console.error('Error filtering customers:', error);
        showAlert('danger', 'Error filtering customers');
    }
}

function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('sortOptions').value = 'name_asc';
    loadCustomers();
}
async function editCustomer(customerId) {
    try {
        const result = await window.api.database.executeQuery(
            'SELECT CustomerID, Name, Email, Address FROM Customer WHERE CustomerID = @param0',
            [customerId]
        );

        if (result.success && result.data.length > 0) {
            const customer = result.data[0];

            document.getElementById('editCustomerId').value = customer.CustomerID;
            document.getElementById('editCustomerName').value = customer.Name;
            document.getElementById('editCustomerEmail').value = customer.Email || '';
            document.getElementById('editCustomerAddress').value = customer.Address || '';

            const editModal = new bootstrap.Modal(document.getElementById('editCustomerModal'));
            editModal.show();
        } else {
            showAlert('danger', 'Failed to load customer details');
        }
    } catch (error) {
        console.error('Error loading customer:', error);
        showAlert('danger', 'Error loading customer details');
    }
}

async function updateCustomer() {
    const customerData = {
        id: parseInt(document.getElementById('editCustomerId').value),
        name: document.getElementById('editCustomerName').value,
        email: document.getElementById('editCustomerEmail').value,
        address: document.getElementById('editCustomerAddress').value
    };

    try {
        const updateBtn = document.getElementById('updateCustomerBtn');
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';

        const result = await window.api.callApi('PUT', '/customer/update', customerData);

        if (result.success) {
            showAlert('success', 'Customer updated successfully');
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editCustomerModal'));
            editModal.hide();
            await loadCustomers();
        } else {
            showAlert('danger', result.message || 'Failed to update customer');
        }
    } catch (error) {
        console.error('Error updating customer:', error);
        showAlert('danger', 'Error updating customer');
    } finally {
        const updateBtn = document.getElementById('updateCustomerBtn');
        updateBtn.disabled = false;
        updateBtn.innerHTML = 'Update Customer';
    }
}

async function deleteCustomer(customerId) {
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteCustomerModal'));
    const confirmDeleteBtn = document.getElementById('confirmDeleteCustomerBtn');

    deleteModal.show();

    confirmDeleteBtn.replaceWith(confirmDeleteBtn.cloneNode(true));

    document.getElementById('confirmDeleteCustomerBtn').addEventListener('click', async () => {
        try {
            const deleteBtn = document.getElementById('confirmDeleteCustomerBtn');
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Deleting...';

            const result = await window.api.callApi('DELETE', '/customer/delete', { id: customerId });

            if (result.success) {
                showAlert('success', 'Customer deleted successfully');
                deleteModal.hide();
                await loadCustomers();
            } else {
                document.getElementById('deleteCustomerAlert').textContent = result.message;
                document.getElementById('deleteCustomerAlert').classList.remove('d-none');
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            showAlert('danger', 'Error deleting customer');
        } finally {
            const deleteBtn = document.getElementById('confirmDeleteCustomerBtn');
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = 'Delete Customer';
        }
    });
}

async function viewCustomerOrders(customerId, customerName) {
    try {
        const result = await window.api.database.executeQuery(`
            SELECT 
                o.OrderID,
                o.Order_Date,
                o.Status,
                ISNULL((
                    SELECT SUM(od.Quantity * p.Prod_Price)
                    FROM Order_Details od
                    JOIN Product p ON od.ProductID = p.ProductID
                    WHERE od.OrderID = o.OrderID
                ), 0) as TotalAmount
            FROM "Order" o
            WHERE o.CustomerID = @param0
            ORDER BY o.Order_Date DESC
        `, [customerId]);

        document.getElementById('orderCustomerName').textContent = customerName;

        const ordersList = document.getElementById('customerOrdersList');
        const noOrdersMessage = document.getElementById('noOrdersMessage');

        if (result.success) {
            if (result.data && result.data.length > 0) {
                ordersList.innerHTML = result.data.map(order => `
                    <tr>
                        <td>${order.OrderID}</td>
                        <td>${new Date(order.Order_Date).toLocaleDateString()}</td>
                        <td>$${order.TotalAmount.toFixed(2)}</td>
                        <td>
                            <span class="badge ${getOrderStatusBadgeClass(getStatusText(order.Status))}">
                                ${getStatusText(order.Status)}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-info" onclick="viewOrderDetails(${order.OrderID})">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `).join('');
                ordersList.classList.remove('d-none');
                noOrdersMessage.classList.add('d-none');
            } else {
                ordersList.innerHTML = '';
                ordersList.classList.add('d-none');
                noOrdersMessage.classList.remove('d-none');
            }
        } else {
            showAlert('danger', 'Failed to load customer orders');
            return;
        }

        const ordersModal = new bootstrap.Modal(document.getElementById('customerOrdersModal'));
        ordersModal.show();
    } catch (error) {
        console.error('Error loading customer orders:', error);
        showAlert('danger', 'Error loading customer orders');
    }
}

function getOrderStatusBadgeClass(status) {
    switch (status) {
        case 'Completed':
            return 'bg-success';
        case 'Processing':
            return 'bg-info';
        case 'Pending':
            return 'bg-warning';
        case 'Cancelled':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}