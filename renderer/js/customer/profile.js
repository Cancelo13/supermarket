let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    setupEventListeners();
    await loadVouchers();
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

        document.getElementById('fullName').value = currentUser.name;
        document.getElementById('email').value = currentUser.username;
        document.getElementById('address').value = currentUser.address;
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

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateProfile();
    });

    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await changePassword();
    });

    document.getElementById('deleteAccountBtn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        modal.show();
    });

    document.getElementById('deleteConfirmText').addEventListener('input', (e) => {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        confirmBtn.disabled = e.target.value !== 'DELETE';
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        await deleteAccount();
    });
}

async function updateProfile() {
    try {
        const profileData = {
            id: currentUser.id,
            name: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            address: document.getElementById('address').value.trim()
        };

        if (!profileData.name || !profileData.email) {
            showAlert('profileError', 'Name and email are required');
            return;
        }

        const result = await window.api.callApi('POST', '/customer/profile/update', profileData);

        if (result.success) {
            showAlert('profileAlert', 'Profile updated successfully');
            currentUser = { ...currentUser, ...profileData };
        } else {
            showAlert('profileError', result.message || 'Failed to update profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('profileError', 'Failed to update profile');
    }
}

async function changePassword() {
    try {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showAlert('passwordError', 'All password fields are required');
            return;
        }

        if (newPassword !== confirmPassword) {
            showAlert('passwordError', 'New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            showAlert('passwordError', 'New password must be at least 6 characters');
            return;
        }

        const result = await window.api.callApi('POST', '/customer/profile/changePassword', {
            currentPassword,
            newPassword
        });

        if (result.success) {
            showAlert('passwordAlert', 'Password changed successfully');
            document.getElementById('passwordForm').reset();
        } else {
            showAlert('passwordError', result.message || 'Failed to change password');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showAlert('passwordError', 'Failed to change password');
    }
}

async function deleteAccount() {
    try {
        const result = await window.api.callApi('POST', '/customer/profile/delete', {
            customerId: currentUser.id
        });

        if (result.success) {
            await window.api.logout();
            window.api.redirectTo('../index.html');
        } else {
            showAlert('deleteAlert', result.message || 'Failed to delete account');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        showAlert('deleteAlert', 'Failed to delete account');
    }
}

async function loadVouchers() {
    try {
        const result = await window.api.callApi('GET', '/voucher/getAvailable', {
            customerId: currentUser.id
        });

        const container = document.getElementById('vouchersList');
        const loadingElement = document.getElementById('loadingVouchers');

        if (!result.success) {
            loadingElement.textContent = 'Failed to load vouchers';
            return;
        }

        loadingElement.remove();

        if (result.vouchers.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No available vouchers</p>
                </div>
            `;
            return;
        }

        container.innerHTML = result.vouchers.map(voucher => `
            <div class="col-md-4 mb-3">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Voucher Code: ${voucher.Code}</h6>
                        <p class="card-text">
                            <strong>Value:</strong> $${voucher.Discount_Amount.toFixed(2)}<br>
                            ${voucher.Min_Purchase_Amount > 0
                ? `<strong>Min Purchase Required:</strong> $${voucher.Min_Purchase_Amount.toFixed(2)}<br>`
                : '<strong>No minimum purchase required</strong><br>'
            }
                            <strong>Expires:</strong> ${new Date(voucher.Expiry_Date).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading vouchers:', error);
        document.getElementById('loadingVouchers').textContent = 'Failed to load vouchers';
    }
}

function updateCartBadge() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = totalItems;
            badge.classList.toggle('d-none', totalItems === 0);
        }
    } catch (error) {
        console.error('Error updating cart badge:', error);
    }
}

function showAlert(elementId, message, isSuccess = elementId.includes('Alert')) {
    const alertElement = document.getElementById(elementId);
    const errorElement = document.getElementById(elementId.replace('Alert', 'Error'));

    if (isSuccess) {
        alertElement.textContent = message;
        alertElement.classList.remove('d-none');
        errorElement?.classList.add('d-none');

        setTimeout(() => {
            alertElement.classList.add('d-none');
        }, 3000);
    } else {
        errorElement.textContent = message;
        errorElement.classList.remove('d-none');
        alertElement?.classList.add('d-none');
    }
}