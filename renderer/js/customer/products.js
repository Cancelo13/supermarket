let currentUser = null;
let products = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userLoaded = await loadCurrentUser();
        if (userLoaded) {
            await Promise.all([
                loadCategories(),
                loadProducts()
            ]);
            setupEventListeners();
            updateCartBadge();
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('danger', 'Failed to initialize page');
    }
});

async function loadCurrentUser() {
    try {
        const user = await window.api.getCurrentUser();
        if (!user || !user.success) {
            console.log('No user found, redirecting...');
            window.api.redirectTo('../index.html');
            return false;
        }
        currentUser = user;
        return true;
    } catch (error) {
        console.error('Error loading user:', error);
        return false;
    }
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterProducts);
    document.getElementById('categoryFilter').addEventListener('change', filterProducts);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });
}

async function loadCategories() {
    try {
        const result = await window.api.callApi('GET', '/category/getAll');
        if (result.success) {
            const categoryFilter = document.getElementById('categoryFilter');
            categoryFilter.innerHTML = `
                <option value="">All Categories</option>
                ${result.categories.map(category =>
                `<option value="${category.CategoryID}">${category.Category_Name}</option>`
            ).join('')}
            `;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showAlert('danger', 'Failed to load categories');
    }
}

async function loadProducts() {
    try {
        const loadingProducts = document.getElementById('loadingProducts');
        loadingProducts.classList.remove('d-none');

        const result = await window.api.database.executeQuery(`
            SELECT 
                p.ProductID,
                p.Prod_Name,
                p.Prod_Price,
                p.Quantity,
                c.CategoryID,
                c.Category_Name,
                i.Location
            FROM Product p
            LEFT JOIN Category c ON p.CategoryID = c.CategoryID
            LEFT JOIN Inventory i ON p.InventoryID = i.InventoryID
            WHERE p.Quantity > 0
            ORDER BY p.Prod_Name
        `);


        if (result.success && result.data) {
            products = result.data;
            displayProducts(products);
        } else {
            console.error('Failed to load products:', result);
            showAlert('danger', 'Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('danger', 'Error loading products');
    } finally {
        const loadingProducts = document.getElementById('loadingProducts');
        loadingProducts.classList.add('d-none');
    }
}

function displayProducts(productsToDisplay) {
    const productsWrapper = document.getElementById('productsWrapper');
    const loadingProducts = document.getElementById('loadingProducts');
    const noProductsFound = document.getElementById('noProductsFound');
    const productsCountInfo = document.getElementById('productsCountInfo');

    if (!productsWrapper) {
        console.error('Products wrapper element not found!');
        return;
    }

    loadingProducts.classList.add('d-none');

    if (!productsToDisplay || productsToDisplay.length === 0) {
        productsWrapper.innerHTML = '';
        noProductsFound.classList.remove('d-none');
        productsCountInfo.textContent = 'No products found';
        return;
    }

    noProductsFound.classList.add('d-none');
    productsCountInfo.textContent = `Showing ${productsToDisplay.length} products`;

    productsWrapper.innerHTML = productsToDisplay.map(product => `
        <div class="col">
            <div class="card h-100 shadow-sm">
                <div class="card-body">
                    <div class="text-center mb-3">
                        <i class="fas fa-box fa-4x text-primary"></i>
                    </div>
                    <h5 class="card-title text-center">${product.Prod_Name}</h5>
                    <p class="card-text text-center">
                        <span class="badge bg-secondary">${product.Category_Name || 'Uncategorized'}</span>
                    </p>
                    <p class="card-text text-center">
                        <strong class="h4 text-primary">$${product.Prod_Price.toFixed(2)}</strong>
                    </p>
                    <p class="card-text text-center">
                        <span class="badge ${getStockStatusClass(product.Quantity)}">
                            ${getStockStatusText(product.Quantity)}
                        </span>
                    </p>
                </div>
                <div class="card-footer bg-transparent border-top-0 text-center">
                    <button class="btn btn-primary w-100" 
                            onclick="viewProduct(${product.ProductID})"
                            ${product.Quantity === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart me-2"></i>
                        ${product.Quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryId = document.getElementById('categoryFilter').value;

    let filtered = products;

    if (searchTerm) {
        filtered = filtered.filter(product =>
            product.Prod_Name.toLowerCase().includes(searchTerm)
        );
    }

    if (categoryId) {
        filtered = filtered.filter(product =>
            product.CategoryID === parseInt(categoryId)
        );
    }

    displayProducts(filtered);
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    displayProducts(products);
}

async function viewProduct(productId) {
    try {
        const result = await window.api.database.executeQuery(`
            SELECT 
                p.ProductID,
                p.Prod_Name,
                p.Prod_Price,
                p.Quantity,
                c.Category_Name
            FROM Product p
            LEFT JOIN Category c ON p.CategoryID = c.CategoryID
            WHERE p.ProductID = @param0
        `, [productId]);

        if (result.success && result.data.length > 0) {
            const product = result.data[0];

            document.getElementById('modalProductName').textContent = product.Prod_Name;
            document.getElementById('modalProductCategory').textContent = product.Category_Name || 'Uncategorized';
            document.getElementById('modalProductPrice').textContent = `$${product.Prod_Price.toFixed(2)}`;

            const lowStockAlert = document.getElementById('modalProductLowStock');
            const outOfStockAlert = document.getElementById('modalProductOutOfStock');
            const addToCartBtn = document.getElementById('addToCartBtn');

            lowStockAlert.classList.add('d-none');
            outOfStockAlert.classList.add('d-none');

            if (product.Quantity === 0) {
                outOfStockAlert.classList.remove('d-none');
                addToCartBtn.disabled = true;
            } else if (product.Quantity <= 5) {
                lowStockAlert.classList.remove('d-none');
                addToCartBtn.disabled = false;
            } else {
                addToCartBtn.disabled = false;
            }

            addToCartBtn.onclick = () => addToCart(product);

            const productModal = new bootstrap.Modal(document.getElementById('productModal'));
            productModal.show();
        }
    } catch (error) {
        console.error('Error loading product details:', error);
        showAlert('danger', 'Error loading product details');
    }
}

function addToCart(product) {
    const existingItem = cart.find(item => item.productId === product.ProductID);

    if (existingItem) {
        if (existingItem.quantity < product.Quantity) {
            existingItem.quantity += 1;
            showAlert('success', 'Cart updated successfully');
        } else {
            showAlert('warning', 'Cannot add more of this item - stock limit reached');
            return;
        }
    } else {
        cart.push({
            productId: product.ProductID,
            name: product.Prod_Name,
            price: product.Prod_Price,
            quantity: 1,
            maxQuantity: product.Quantity
        });
        showAlert('success', 'Product added to cart');
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();

    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
}

function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badges = document.querySelectorAll('#cartBadge, #cartCount');
    badges.forEach(badge => {
        badge.textContent = totalItems;
        badge.classList.toggle('d-none', totalItems === 0);
    });
}

function getStockStatusClass(quantity) {
    if (quantity === 0) return 'bg-danger';
    if (quantity <= 5) return 'bg-warning';
    return 'bg-success';
}

function getStockStatusText(quantity) {
    if (quantity === 0) return 'Out of Stock';
    if (quantity <= 5) return 'Low Stock';
    return 'In Stock';
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