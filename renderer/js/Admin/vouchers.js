let currentPage = 1;
const pageSize = 10;
let vouchers = [];
let customers = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    await loadCustomers();
    setupEventListeners();
    await loadVouchers();
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

async function loadCustomers() {
    try {
        const result = await window.api.callApi('GET', '/customer/getAll');
        if (result.success) {
            customers = result.customers;
            updateCustomerDropdowns();
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        showAlert('danger', 'Failed to load customers');
    }
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterVouchers);
    document.getElementById('statusFilter').addEventListener('change', filterVouchers);
    document.getElementById('sortOptions').addEventListener('change', filterVouchers);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
    document.getElementById('saveVoucherBtn').addEventListener('click', createVoucher);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });
}

async function loadVouchers() {
    try {
        const result = await window.api.database.executeQuery(`
            SELECT 
                v.VoucherID,
                v.Code,
                v.Discount_Amount,
                v.Expiry_Date,
                v.Min_Purchase_Amount,
                v.Used,
                v.Used_Date,
                v.CustomerID,
                c.Name as CustomerName,
                o.OrderID
            FROM Voucher v
            LEFT JOIN Customer c ON v.CustomerID = c.CustomerID
            LEFT JOIN [Order] o ON v.OrderID = o.OrderID
            ORDER BY v.Created_Date DESC
        `);

        if (result.success) {
            vouchers = result.data;
            updateVouchersTable(vouchers);
        } else {
            showAlert('danger', 'Failed to load vouchers');
        }
    } catch (error) {
        console.error('Error loading vouchers:', error);
        showAlert('danger', 'Error loading vouchers');
    }
}

function updateVouchersTable(vouchersToShow) {
    const tableBody = document.getElementById('vouchersTableBody');

    if (vouchersToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No vouchers found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = vouchersToShow.map(voucher => `
        <tr>
            <td>
                <span class="fw-bold">${voucher.Code}</span>
            </td>
            <td>$${voucher.Discount_Amount.toFixed(2)}</td>
            <td>${new Date(voucher.Expiry_Date).toLocaleDateString()}</td>
            <td>${voucher.CustomerName || '<span class="text-muted">Not assigned</span>'}</td>
            <td>
                ${getVoucherStatusBadge(voucher)}
            </td>
            <td>
                <button class="btn btn-sm btn-primary me-1" 
                    onclick="editVoucher(${voucher.VoucherID})"
                    ${voucher.Used ? 'disabled' : ''}>
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" 
                    onclick="deleteVoucher(${voucher.VoucherID})"
                    ${voucher.Used ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCustomerDropdowns() {
    const customerSelects = ['voucherCustomer', 'editVoucherCustomer'];
    customerSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = `
                <option value="">Not assigned to any customer</option>
                ${customers.map(customer => `
                    <option value="${customer.CustomerID}">${customer.Name}</option>
                `).join('')}
            `;
        }
    });
}

function filterVouchers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const sortOption = document.getElementById('sortOptions').value;

    let filtered = [...vouchers];

    if (searchTerm) {
        filtered = filtered.filter(voucher =>
            voucher.Code.toLowerCase().includes(searchTerm) ||
            (voucher.CustomerName && voucher.CustomerName.toLowerCase().includes(searchTerm))
        );
    }

    switch (statusFilter) {
        case 'active':
            filtered = filtered.filter(v => !v.Used && new Date(v.Expiry_Date) > new Date());
            break;
        case 'expired':
            filtered = filtered.filter(v => new Date(v.Expiry_Date) < new Date());
            break;
        case 'assigned':
            filtered = filtered.filter(v => v.CustomerID);
            break;
        case 'unassigned':
            filtered = filtered.filter(v => !v.CustomerID);
            break;
    }

    switch (sortOption) {
        case 'expiry_asc':
            filtered.sort((a, b) => new Date(a.Expiry_Date) - new Date(b.Expiry_Date));
            break;
        case 'expiry_desc':
            filtered.sort((a, b) => new Date(b.Expiry_Date) - new Date(a.Expiry_Date));
            break;
        case 'value_asc':
            filtered.sort((a, b) => a.Discount_Amount - b.Discount_Amount);
            break;
        case 'value_desc':
            filtered.sort((a, b) => b.Discount_Amount - a.Discount_Amount);
            break;
    }

    updateVouchersTable(filtered);
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('sortOptions').value = 'expiry_asc';
    updateVouchersTable(vouchers);
}

async function createVoucher() {
    try {
        const voucherData = {
            amount: parseFloat(document.getElementById('voucherValue').value),
            expiryDate: document.getElementById('voucherExpiry').value,
            customerId: document.getElementById('voucherCustomer').value || null,
            minPurchaseAmount: parseFloat(document.getElementById('minPurchaseAmount')?.value || '0')
        };

        if (!voucherData.amount || !voucherData.expiryDate) {
            showAlert('danger', 'Please fill in all required fields');
            return;
        }

        if (new Date(voucherData.expiryDate) < new Date()) {
            showAlert('danger', 'Expiry date cannot be in the past');
            return;
        }

        const result = await window.api.callApi('POST', '/voucher/create', voucherData);

        if (result.success) {
            await loadVouchers();
            const modal = bootstrap.Modal.getInstance(document.getElementById('addVoucherModal'));
            modal.hide();
            showAlert('success', `Voucher created successfully: ${result.code}`);
            document.getElementById('addVoucherForm').reset();
        } else {
            showAlert('danger', result.message || 'Failed to create voucher');
        }
    } catch (error) {
        console.error('Error creating voucher:', error);
        showAlert('danger', 'Error creating voucher');
    }
}

async function editVoucher(voucherId) {
    const voucher = vouchers.find(v => v.VoucherID === voucherId);
    if (!voucher) return;

    document.getElementById('editVoucherId').value = voucherId;
    document.getElementById('editVoucherCode').value = voucher.Code;
    document.getElementById('editVoucherValue').value = voucher.Discount_Amount;
    document.getElementById('editVoucherExpiry').value = new Date(voucher.Expiry_Date).toISOString().split('T')[0];
    document.getElementById('editVoucherCustomer').value = voucher.CustomerID || '';

    const modal = new bootstrap.Modal(document.getElementById('editVoucherModal'));
    modal.show();

    document.getElementById('updateVoucherBtn').onclick = async () => {
        try {
            const updatedData = {
                voucherId: voucherId,
                discountAmount: parseFloat(document.getElementById('editVoucherValue').value),
                expiryDate: document.getElementById('editVoucherExpiry').value,
                customerId: document.getElementById('editVoucherCustomer').value || null
            };

            if (new Date(updatedData.expiryDate) < new Date()) {
                showAlert('danger', 'Expiry date cannot be in the past');
                return;
            }

            const result = await window.api.database.executeQuery(`
                UPDATE Voucher 
                SET Discount_Amount = @discount,
                    Expiry_Date = @expiry,
                    CustomerID = @customerId
                WHERE VoucherID = @voucherId
            `, [updatedData.discountAmount, updatedData.expiryDate, updatedData.customerId, updatedData.voucherId]);

            if (result.success) {
                await loadVouchers();
                modal.hide();
                showAlert('success', 'Voucher updated successfully');
            } else {
                showAlert('danger', 'Failed to update voucher');
            }
        } catch (error) {
            console.error('Error updating voucher:', error);
            showAlert('danger', 'Error updating voucher');
        }
    };
}

async function deleteVoucher(voucherId) {
    const modal = new bootstrap.Modal(document.getElementById('deleteVoucherModal'));
    modal.show();

    document.getElementById('confirmDeleteVoucherBtn').onclick = async () => {
        try {
            const result = await window.api.database.executeQuery(
                'DELETE FROM Voucher WHERE VoucherID = @param0 AND Used = 0',
                [voucherId]
            );

            if (result.success) {
                await loadVouchers();
                modal.hide();
                showAlert('success', 'Voucher deleted successfully');
            } else {
                showAlert('danger', 'Failed to delete voucher');
            }
        } catch (error) {
            console.error('Error deleting voucher:', error);
            showAlert('danger', 'Error deleting voucher');
        }
    };
}

function getVoucherStatusBadge(voucher) {
    if (voucher.Used) {
        return `<span class="badge bg-secondary">Used on ${new Date(voucher.Used_Date).toLocaleDateString()}</span>`;
    }

    const now = new Date();
    const expiryDate = new Date(voucher.Expiry_Date);

    if (expiryDate < now) {
        return '<span class="badge bg-danger">Expired</span>';
    }

    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 7) {
        return `<span class="badge bg-warning">Expires in ${daysUntilExpiry} days</span>`;
    }

    return '<span class="badge bg-success">Active</span>';
}

function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        console.error('Alert container not found');
        return;
    }

    alertContainer.innerHTML = '';

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alert);

    if (type === 'danger') {
        console.error('Error:', message);
    }

    setTimeout(() => {
        alert.remove();
    }, 5000);
}