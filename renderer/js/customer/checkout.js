let currentUser = null;
let cart = JSON.parse(sessionStorage.getItem('checkoutCart') || '[]');
let selectedVoucher = null;
let subtotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    loadCheckoutItems();
    await loadVouchers();
    prefillShippingInfo();
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
    document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
    document.getElementById('paymentForm').addEventListener('change', togglePaymentFields);

    document.getElementById('shippingForm').addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('paymentForm').addEventListener('submit', (e) => e.preventDefault());
}

function loadCheckoutItems() {
    const checkoutItems = document.getElementById('checkoutItems');

    if (!cart || cart.length === 0) {
        window.api.redirectTo('cart.html');
        return;
    }

    subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    checkoutItems.innerHTML = cart.map(item => `
        <tr>
            <td>
                ${item.name} x ${item.quantity}
                <br>
                <small class="text-muted">Unit Price: $${item.price.toFixed(2)}</small>
            </td>
            <td>$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    updateTotals();
}

async function loadVouchers() {
    try {
        const result = await window.api.callApi('GET', '/voucher/getAvailable', {
            customerId: currentUser.id
        });

        const vouchersList = document.getElementById('vouchersList');
        const loadingVouchers = document.getElementById('loadingVouchers');
        const noVouchers = document.getElementById('noVouchers');

        loadingVouchers.classList.add('d-none');

        if (result.success && result.vouchers.length > 0) {
            vouchersList.innerHTML = result.vouchers.map(voucher => `
                <div class="form-check mb-2">
                    <input class="form-check-input" type="radio" name="voucher" 
                           id="voucher_${voucher.VoucherID}" 
                           value="${voucher.VoucherID}"
                           data-amount="${voucher.Discount_Amount}"
                           data-min="${voucher.Min_Purchase_Amount}"
                           onchange="handleVoucherSelection(this)">
                    <label class="form-check-label" for="voucher_${voucher.VoucherID}">
                        ${voucher.Code} - $${voucher.Discount_Amount} off
                        <br>
                        <small class="text-muted">
                            Min. purchase: $${voucher.Min_Purchase_Amount}
                            (Expires: ${new Date(voucher.Expiry_Date).toLocaleDateString()})
                        </small>
                    </label>
                </div>
            `).join('');
            vouchersList.classList.remove('d-none');
            noVouchers.classList.add('d-none');
        } else {
            vouchersList.classList.add('d-none');
            noVouchers.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error loading vouchers:', error);
        showAlert('danger', 'Failed to load vouchers');
    }
}

function handleVoucherSelection(radio) {
    selectedVoucher = {
        id: parseInt(radio.value),
        amount: parseFloat(radio.dataset.amount),
        minPurchase: parseFloat(radio.dataset.min)
    };

    if (subtotal < selectedVoucher.minPurchase) {
        radio.checked = false;
        selectedVoucher = null;
        showAlert('warning', `Minimum purchase amount not met. Add more items worth $${(selectedVoucher.minPurchase - subtotal).toFixed(2)} to use this voucher.`);
    }

    updateTotals();
}

function updateTotals() {
    const discount = selectedVoucher ? selectedVoucher.amount : 0;
    const total = Math.max(0, subtotal - discount);

    document.getElementById('checkoutTotal').textContent = `$${total.toFixed(2)}`;
}

function prefillShippingInfo() {
    if (currentUser && currentUser.address) {
        const addressParts = currentUser.address.split(',').map(part => part.trim());
        if (addressParts.length >= 3) {
            document.getElementById('shippingAddress').value = addressParts[0];
            document.getElementById('city').value = addressParts[1];
            document.getElementById('zipCode').value = addressParts[2];
        } else {
            document.getElementById('shippingAddress').value = currentUser.address;
        }
    }
}

function togglePaymentFields() {
    const creditCardDetails = document.getElementById('creditCardDetails');
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    creditCardDetails.style.display = paymentMethod === 'creditCard' ? 'block' : 'none';
}

async function placeOrder() {
    try {
        const shippingAddress = `${document.getElementById('shippingAddress').value}, ${document.getElementById('city').value}, ${document.getElementById('zipCode').value}, ${document.getElementById('country').value}`;

        if (!validateForms()) {
            return;
        }

        const placeOrderBtn = document.getElementById('placeOrderBtn');
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';

        const orderData = {
            customerId: currentUser.id,
            items: cart,
            shippingAddress: shippingAddress,
            total: subtotal - (selectedVoucher ? selectedVoucher.amount : 0),
            voucherId: selectedVoucher ? selectedVoucher.id : null
        };

        const result = await window.api.callApi('POST', '/order/create', orderData);

        if (result.success) {
            localStorage.removeItem('cart');
            sessionStorage.removeItem('checkoutCart');

            document.getElementById('successOrderId').textContent = result.orderId;
            const successModal = new bootstrap.Modal(document.getElementById('orderSuccessModal'));
            successModal.show();
        } else {
            showAlert('danger', result.message || 'Failed to place order');
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i> Place Order';
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showAlert('danger', 'Error placing order');
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i> Place Order';
    }
}

function validateForms() {
    const shippingForm = document.getElementById('shippingForm');
    const paymentForm = document.getElementById('paymentForm');

    if (!shippingForm.checkValidity()) {
        showAlert('danger', 'Please fill in all shipping information');
        return false;
    }

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    if (paymentMethod === 'creditCard') {
        const cardFields = ['cardNumber', 'expiryDate', 'cvv', 'cardName'];
        for (const field of cardFields) {
            if (!document.getElementById(field).value) {
                showAlert('danger', 'Please fill in all card details');
                return false;
            }
        }
    }

    return true;
}

function showAlert(type, message) {
    const alertDiv = document.getElementById('checkoutAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.classList.remove('d-none');

    setTimeout(() => {
        alertDiv.classList.add('d-none');
    }, 5000);
}