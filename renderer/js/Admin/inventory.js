let stockThreshold = parseInt(localStorage.getItem('stockThreshold') || '20');

document.addEventListener('DOMContentLoaded', async () => {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    await loadInventory();
    await loadLowStock();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterInventory);
    document.getElementById('locationFilter').addEventListener('change', filterInventory);
    document.getElementById('sortOptions').addEventListener('change', filterInventory);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    document.getElementById('updateInventoryBtn').addEventListener('click', updateInventory);

    document.getElementById('saveThresholdBtn').addEventListener('click', async () => {
        const newThreshold = parseInt(document.getElementById('stockThreshold').value);
        if (newThreshold > 0) {
            stockThreshold = newThreshold;
            localStorage.setItem('stockThreshold', stockThreshold.toString());

            await loadLowStock();

            const modal = bootstrap.Modal.getInstance(document.getElementById('setThresholdModal'));
            modal.hide();
            showAlert('success', `Restock threshold updated to ${stockThreshold}`);
        } else {
            showAlert('danger', 'Please enter a valid threshold value greater than 0');
        }
    });

    const setThresholdModal = document.getElementById('setThresholdModal');
    setThresholdModal.addEventListener('show.bs.modal', () => {
        document.getElementById('stockThreshold').value = stockThreshold;
    });
}

async function loadInventory() {
    try {
        const result = await window.api.callApi('GET', '/inventory/getAll');
        if (result.success) {
            updateInventoryTable(result.inventory);
            updateLocationFilter(result.inventory);
        } else {
            showAlert('danger', 'Failed to load inventory');
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        showAlert('danger', 'Error loading inventory');
    }
}

async function loadLowStock() {
    try {
        const result = await window.api.callApi('GET', '/inventory/getLowStock', { threshold: stockThreshold });

        if (result.success) {
            updateLowStockTable(result.lowStock);

            const lowStockBadge = document.getElementById('lowStockBadge');
            const lowStockCount = document.getElementById('lowStockCount');
            const count = result.lowStock ? result.lowStock.length : 0;

            if (lowStockBadge) lowStockBadge.textContent = count;
            if (lowStockCount) lowStockCount.textContent = count;

            const thresholdInfo = document.querySelector('.text-muted');
            if (thresholdInfo) {
                thresholdInfo.textContent =
                    `Items with stock level at or below ${stockThreshold} units are shown here.`;
            }
        } else {
            showAlert('danger', 'Failed to load low stock items');
        }
    } catch (error) {
        console.error('Error loading low stock:', error);
        showAlert('danger', 'Error loading low stock items');
    }
}

function updateInventoryTable(inventory) {
    const tableBody = document.getElementById('inventoryTableBody');
    const noInventoryMessage = document.getElementById('noInventoryMessage');

    if (inventory && inventory.length > 0) {
        tableBody.innerHTML = inventory.map(item => `
            <tr>
                <td>${item.InventoryID}</td>
                <td>${item.Prod_Name}</td>
                <td>${item.Location || 'N/A'}</td>
                <td>${item.Quantity}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(item.Status)}">
                        ${item.Status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="editInventory(${item.InventoryID}, '${item.Prod_Name}', ${item.Quantity}, '${item.Location || ''}')">
                        <i class="fas fa-edit"></i> Update
                    </button>
                </td>
            </tr>
        `).join('');
        noInventoryMessage.classList.add('d-none');
    } else {
        tableBody.innerHTML = '';
        noInventoryMessage.classList.remove('d-none');
    }
}

function updateLowStockTable(lowStock) {
    const tableBody = document.getElementById('lowStockTableBody');
    const noLowStockMessage = document.getElementById('noLowStockMessage');
    const lowStockBadge = document.getElementById('lowStockBadge');
    const lowStockCount = document.getElementById('lowStockCount');

    if (lowStock && lowStock.length > 0) {
        tableBody.innerHTML = lowStock.map(item => `
            <tr>
                <td>${item.ProductID}</td>
                <td>${item.Prod_Name}</td>
                <td>${item.Category_Name || 'N/A'}</td>
                <td>${item.Location || 'N/A'}</td>
                <td>${item.Quantity}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="editInventory(${item.InventoryID}, '${item.Prod_Name}', ${item.Quantity}, '${item.Location || ''}')">
                        <i class="fas fa-edit"></i> Update
                    </button>
                </td>
            </tr>
        `).join('');
        noLowStockMessage.classList.add('d-none');
        lowStockBadge.textContent = lowStock.length;
        lowStockCount.textContent = lowStock.length;
    } else {
        tableBody.innerHTML = '';
        noLowStockMessage.classList.remove('d-none');
        lowStockBadge.textContent = '0';
        lowStockCount.textContent = '0';
    }
}

function editInventory(inventoryId, productName, quantity, location) {
    document.getElementById('editInventoryId').value = inventoryId;
    document.getElementById('editProductName').value = productName;
    document.getElementById('editInventoryQuantity').value = quantity;
    document.getElementById('editInventoryLocation').value = location;

    const editModal = new bootstrap.Modal(document.getElementById('editInventoryModal'));
    editModal.show();
}

async function updateInventory() {
    const updateBtn = document.getElementById('updateInventoryBtn');
    const inventoryData = {
        inventoryId: parseInt(document.getElementById('editInventoryId').value),
        quantity: parseInt(document.getElementById('editInventoryQuantity').value),
        location: document.getElementById('editInventoryLocation').value
    };

    try {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';

        const result = await window.api.callApi('PUT', '/inventory/update', inventoryData);

        if (result.success) {
            showAlert('success', 'Inventory updated successfully');
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editInventoryModal'));
            editModal.hide();
            await loadInventory();
            await loadLowStock();
        } else {
            showAlert('danger', result.message || 'Failed to update inventory');
        }
    } catch (error) {
        console.error('Error updating inventory:', error);
        showAlert('danger', 'Error updating inventory');
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = 'Update Inventory';
    }
}

function updateThreshold() {
    const newThreshold = parseInt(document.getElementById('stockThreshold').value);
    if (newThreshold > 0) {
        stockThreshold = newThreshold;
        loadLowStock();
        const modal = bootstrap.Modal.getInstance(document.getElementById('setThresholdModal'));
        modal.hide();
        showAlert('success', 'Threshold updated successfully');
    } else {
        showAlert('danger', 'Please enter a valid threshold value');
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'In Stock':
            return 'bg-success';
        case 'Low Stock':
            return 'bg-warning';
        case 'Out of Stock':
            return 'bg-danger';
        default:
            return 'bg-secondary';
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

function updateLocationFilter(inventory) {
    const locationSelect = document.getElementById('locationFilter');
    const locations = new Set(inventory
        .map(item => item.Location)
        .filter(location => location && location.trim() !== '')
    );

    const options = Array.from(locations).sort().map(location =>
        `<option value="${location}">${location}</option>`
    );

    locationSelect.innerHTML = `
        <option value="">All Locations</option>
        ${options.join('')}
    `;
}

async function filterInventory() {
    try {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const locationFilter = document.getElementById('locationFilter').value;
        const sortOption = document.getElementById('sortOptions').value;

        const result = await window.api.callApi('GET', '/inventory/getAll');

        if (result.success) {
            let filteredInventory = result.inventory;

            if (searchTerm) {
                filteredInventory = filteredInventory.filter(item =>
                    item.Prod_Name.toLowerCase().includes(searchTerm) ||
                    (item.Location && item.Location.toLowerCase().includes(searchTerm))
                );
            }

            if (locationFilter) {
                filteredInventory = filteredInventory.filter(item =>
                    item.Location === locationFilter
                );
            }

            filteredInventory.sort((a, b) => {
                switch (sortOption) {
                    case 'product_asc':
                        return a.Prod_Name.localeCompare(b.Prod_Name);
                    case 'product_desc':
                        return b.Prod_Name.localeCompare(a.Prod_Name);
                    case 'quantity_asc':
                        return a.Quantity - b.Quantity;
                    case 'quantity_desc':
                        return b.Quantity - a.Quantity;
                    case 'location_asc':
                        return (a.Location || '').localeCompare(b.Location || '');
                    default:
                        return 0;
                }
            });

            updateInventoryTable(filteredInventory);
        }
    } catch (error) {
        console.error('Error filtering inventory:', error);
        showAlert('danger', 'Error filtering inventory');
    }
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('locationFilter').value = '';
    document.getElementById('sortOptions').value = 'product_asc';
    loadInventory();
}

async function loadInventory() {
    try {
        const result = await window.api.callApi('GET', '/inventory/getAll');
        if (result.success) {
            updateInventoryTable(result.inventory);
            updateLocationFilter(result.inventory);
        } else {
            showAlert('danger', 'Failed to load inventory');
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        showAlert('danger', 'Error loading inventory');
    }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    window.api.logout();
    window.api.redirectTo('../index.html');
});