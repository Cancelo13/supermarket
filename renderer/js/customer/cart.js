let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    updateCart();
});

async function loadCurrentUser() {
    try {
        const result = await window.api.getCurrentUser();
        if (!result.success) {
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
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('proceedToCheckoutBtn').addEventListener('click', proceedToCheckout);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.api.logout();
        window.api.redirectTo('../index.html');
    });
}

async function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const checkoutBtn = document.getElementById('proceedToCheckoutBtn');
    const cartBadge = document.getElementById('cartBadge');

    if (cart.length === 0) {
        emptyCartMessage.classList.remove('d-none');
        cartItemsContainer.classList.add('d-none');
        checkoutBtn.disabled = true;
        cartBadge.textContent = '0';
        updateTotals(0);
        return;
    }

    emptyCartMessage.classList.add('d-none');
    cartItemsContainer.classList.remove('d-none');
    checkoutBtn.disabled = false;

    try {
        const productIds = cart.map(item => item.productId).join(',');
        const result = await window.api.database.executeQuery(`
            SELECT 
                ProductID,
                Prod_Name,
                Prod_Price,
                Quantity as StockQuantity
            FROM Product 
            WHERE ProductID IN (${productIds})
        `);

        if (!result.success) {
            showAlert('danger', 'Failed to load cart items');
            return;
        }

        const products = result.data;
        let cartHTML = '';
        let subtotal = 0;
        let itemCount = 0;

        cart = cart.filter(cartItem => {
            const product = products.find(p => p.ProductID === cartItem.productId);
            if (!product) return false;

            cartItem.price = product.Prod_Price;
            cartItem.maxQuantity = product.StockQuantity;
            if (cartItem.quantity > product.StockQuantity) {
                cartItem.quantity = product.StockQuantity;
            }
            return true;
        });

        cart.forEach(cartItem => {
            const product = products.find(p => p.ProductID === cartItem.productId);
            const itemTotal = cartItem.price * cartItem.quantity;
            subtotal += itemTotal;
            itemCount += cartItem.quantity;

            cartHTML += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="ms-3">
                                <h6 class="mb-0">${product.Prod_Name}</h6>
                                <small class="text-muted">Unit Price: $${product.Prod_Price.toFixed(2)}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="input-group input-group-sm" style="width: 120px;">
                            <button class="btn btn-outline-secondary" type="button" 
                                onclick="updateQuantity(${cartItem.productId}, ${cartItem.quantity - 1})">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="text" class="form-control text-center" value="${cartItem.quantity}" readonly>
                            <button class="btn btn-outline-secondary" type="button" 
                                onclick="updateQuantity(${cartItem.productId}, ${cartItem.quantity + 1})"
                                ${cartItem.quantity >= cartItem.maxQuantity ? 'disabled' : ''}>
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        ${cartItem.quantity >= cartItem.maxQuantity ?
                    '<small class="text-danger d-block">Max stock reached</small>' : ''}
                    </td>
                    <td>$${itemTotal.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" 
                            onclick="removeFromCart(${cartItem.productId})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        cartItems.innerHTML = cartHTML;
        cartBadge.textContent = itemCount.toString();
        updateTotals(subtotal);

        localStorage.setItem('cart', JSON.stringify(cart));
    } catch (error) {
        console.error('Error updating cart:', error);
        showAlert('danger', 'Error updating cart');
    }
}

function updateTotals(subtotal) {
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('total').textContent = `$${subtotal.toFixed(2)}`;
}

async function updateQuantity(productId, newQuantity) {
    if (newQuantity < 1) return;

    const cartItem = cart.find(item => item.productId === productId);
    if (!cartItem) return;

    if (newQuantity <= cartItem.maxQuantity) {
        cartItem.quantity = newQuantity;
        await updateCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCart();
    showAlert('success', 'Item removed from cart');
}

function clearCart() {
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCart();
    showAlert('success', 'Cart cleared');
}

async function proceedToCheckout() {
    if (cart.length === 0) {
        showAlert('warning', 'Your cart is empty');
        return;
    }

    sessionStorage.setItem('checkoutCart', JSON.stringify(cart));
    window.api.redirectTo('checkout.html');
}

function showAlert(type, message) {
    const alertContainer = document.getElementById('cartAlert');
    alertContainer.className = `alert alert-${type}`;
    alertContainer.textContent = message;
    alertContainer.classList.remove('d-none');

    setTimeout(() => {
        alertContainer.classList.add('d-none');
    }, 3000);
}