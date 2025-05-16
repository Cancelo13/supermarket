document.addEventListener('DOMContentLoaded', function () {
    const addProductForm = document.getElementById('addProductForm');
    const saveProductBtn = document.getElementById('saveProductBtn');
    const addProductModal = new bootstrap.Modal(document.getElementById('addProductModal'));

    loadProducts();
    loadCategories();

    saveProductBtn.addEventListener('click', async function () {
        const productData = {
            name: document.getElementById('productName').value,
            categoryId: parseInt(document.getElementById('productCategory').value),
            price: parseFloat(document.getElementById('productPrice').value),
            quantity: parseInt(document.getElementById('productQuantity').value),
            location: document.getElementById('productLocation').value || ''
        };

        try {
            saveProductBtn.disabled = true;
            saveProductBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Adding...';

            const result = await window.api.callApi('POST', '/product/add', productData);

            if (result.success) {
                showAlert('success', 'Product added successfully!');
                addProductForm.reset();
                addProductModal.hide();
                await loadProducts();
            } else {
                showAlert('danger', result.message || 'Failed to add product');
            }
        } catch (error) {
            showAlert('danger', 'Error adding product');
        } finally {
            saveProductBtn.disabled = false;
            saveProductBtn.innerHTML = 'Add Product';
        }
    });
});

async function loadCategories() {
    try {
        const result = await window.api.database.executeQuery(
            'SELECT CategoryID, Category_Name FROM Category ORDER BY Category_Name'
        );

        if (result.success) {
            const categorySelects = [
                document.getElementById('productCategory'),
                document.getElementById('editProductCategory'),
                document.getElementById('categoryFilter')
            ];

            const options = result.data.map(category =>
                `<option value="${category.CategoryID}">${category.Category_Name}</option>`
            ).join('');

            categorySelects.forEach(select => {
                if (select) {
                    select.innerHTML = '<option value="">Select Category</option>' + options;
                }
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showAlert('danger', 'Failed to load categories');
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
async function loadProducts() {
    try {
        const query = `
            SELECT 
                p.ProductID,
                p.Prod_Name,
                p.Prod_Price,
                p.Quantity,
                c.Category_Name,
                i.Location,
                CASE 
                    WHEN p.Quantity > 20 THEN 'In Stock'
                    WHEN p.Quantity > 0 THEN 'Low Stock'
                    ELSE 'Out of Stock'
                END as Status
            FROM Product p
            LEFT JOIN Category c ON p.CategoryID = c.CategoryID
            LEFT JOIN Inventory i ON p.InventoryID = i.InventoryID
            ORDER BY p.ProductID DESC
        `;

        const result = await window.api.database.executeQuery(query);
        const productsTableBody = document.getElementById('productsTableBody');
        const noProductsMessage = document.getElementById('noProductsMessage');

        if (result.success && result.data.length > 0) {
            productsTableBody.innerHTML = result.data.map(product => `
                <tr>
                    <td>${product.ProductID}</td>
                    <td>${product.Prod_Name}</td>
                    <td>${product.Category_Name || 'N/A'}</td>
                    <td>$${product.Prod_Price.toFixed(2)}</td>
                    <td>${product.Quantity}</td>
                    <td>
                        <span class="badge ${getStatusBadgeClass(product.Status)}">
                            ${product.Status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="editProduct(${product.ProductID})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.ProductID})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            noProductsMessage.classList.add('d-none');
        } else {
            productsTableBody.innerHTML = '';
            noProductsMessage.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('danger', 'Failed to load products');
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

document.getElementById('searchInput').addEventListener('input', filterProducts);
document.getElementById('categoryFilter').addEventListener('change', filterProducts);
document.getElementById('sortOptions').addEventListener('change', filterProducts);
document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

async function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryId = document.getElementById('categoryFilter').value;
    const sortOption = document.getElementById('sortOptions').value;

    let query = `
        SELECT 
            p.ProductID,
            p.Prod_Name,
            p.Prod_Price,
            p.Quantity,
            c.Category_Name,
            i.Location,
            CASE 
                WHEN p.Quantity > 20 THEN 'In Stock'
                WHEN p.Quantity > 0 THEN 'Low Stock'
                ELSE 'Out of Stock'
            END as Status
        FROM Product p
        LEFT JOIN Category c ON p.CategoryID = c.CategoryID
        LEFT JOIN Inventory i ON p.InventoryID = i.InventoryID
        WHERE 1=1
    `;

    const params = [];

    if (searchTerm) {
        query += ` AND LOWER(p.Prod_Name) LIKE @param0`;
        params.push(`%${searchTerm}%`);
    }

    if (categoryId) {
        query += ` AND p.CategoryID = @param${params.length}`;
        params.push(categoryId);
    }

    query += ` ORDER BY ${getSortQuery(sortOption)}`;

    try {
        const result = await window.api.database.executeQuery(query, params);
        if (result.success) {
            updateProductsTable(result.data);
        } else {
            showAlert('danger', 'Failed to filter products');
        }
    } catch (error) {
        console.error('Error filtering products:', error);
        showAlert('danger', 'Failed to filter products');
    }
}


function getSortQuery(sortOption) {
    switch (sortOption) {
        case 'name_asc':
            return 'p.Prod_Name ASC';
        case 'name_desc':
            return 'p.Prod_Name DESC';
        case 'price_asc':
            return 'p.Prod_Price ASC';
        case 'price_desc':
            return 'p.Prod_Price DESC';
        case 'stock_asc':
            return 'p.Quantity ASC';
        case 'stock_desc':
            return 'p.Quantity DESC';
        default:
            return 'p.ProductID DESC';
    }
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('sortOptions').value = 'name_asc';
    loadProducts();
}

function updateProductsTable(products) {
    const productsTableBody = document.getElementById('productsTableBody');
    const noProductsMessage = document.getElementById('noProductsMessage');

    if (products && products.length > 0) {
        productsTableBody.innerHTML = products.map(product => `
            <tr>
                <td>${product.ProductID}</td>
                <td>${product.Prod_Name}</td>
                <td>${product.Category_Name || 'N/A'}</td>
                <td>$${product.Prod_Price.toFixed(2)}</td>
                <td>${product.Quantity}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(product.Status)}">
                        ${product.Status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="editProduct(${product.ProductID})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.ProductID})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        noProductsMessage.classList.add('d-none');
    } else {
        productsTableBody.innerHTML = '';
        noProductsMessage.classList.remove('d-none');
    }
}

async function editProduct(productId) {
    try {
        const query = `
            SELECT 
                p.ProductID,
                p.Prod_Name,
                p.CategoryID,
                p.Prod_Price,
                p.Quantity,
                i.Location
            FROM Product p
            LEFT JOIN Inventory i ON p.InventoryID = i.InventoryID
            WHERE p.ProductID = @param0
        `;

        const result = await window.api.database.executeQuery(query, [productId]);

        if (result.success && result.data.length > 0) {
            const product = result.data[0];

            document.getElementById('editProductId').value = product.ProductID;
            document.getElementById('editProductName').value = product.Prod_Name;
            document.getElementById('editProductCategory').value = product.CategoryID;
            document.getElementById('editProductPrice').value = product.Prod_Price;
            document.getElementById('editProductQuantity').value = product.Quantity;
            document.getElementById('editProductLocation').value = product.Location || '';

            const editProductModal = new bootstrap.Modal(document.getElementById('editProductModal'));
            editProductModal.show();
        } else {
            showAlert('danger', 'Failed to load product details');
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showAlert('danger', 'Error loading product details');
    }
}

document.getElementById('updateProductBtn').addEventListener('click', async function () {
    const productId = document.getElementById('editProductId').value;
    const productData = {
        id: parseInt(productId),
        name: document.getElementById('editProductName').value,
        categoryId: parseInt(document.getElementById('editProductCategory').value),
        price: parseFloat(document.getElementById('editProductPrice').value),
        quantity: parseInt(document.getElementById('editProductQuantity').value),
        location: document.getElementById('editProductLocation').value
    };

    try {
        const updateBtn = this;
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';

        const result = await window.api.callApi('PUT', '/product/update', productData);

        if (result.success) {
            showAlert('success', 'Product updated successfully!');
            const editProductModal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
            editProductModal.hide();
            await loadProducts();
        } else {
            showAlert('danger', result.message || 'Failed to update product');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showAlert('danger', 'Error updating product');
    } finally {
        const updateBtn = document.getElementById('updateProductBtn');
        updateBtn.disabled = false;
        updateBtn.innerHTML = 'Update Product';
    }
});

async function deleteProduct(productId) {
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    document.getElementById('deleteConfirmText').textContent =
        'Are you sure you want to delete this product? This action cannot be undone.';

    deleteConfirmModal.show();

    confirmDeleteBtn.onclick = async () => {
        try {
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Deleting...';

            const result = await window.api.callApi('DELETE', '/product/delete', { id: productId });

            if (result.success) {
                showAlert('success', 'Product deleted successfully!');
                deleteConfirmModal.hide();
                await loadProducts();
            } else {
                showAlert('danger', result.message || 'Failed to delete product');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showAlert('danger', 'Error deleting product');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.innerHTML = 'Delete';
        }
    };
}