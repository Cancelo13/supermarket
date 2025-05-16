async function loadCategories() {
    try {
        const result = await window.api.callApi('GET', '/category/getAll');

        if (result.success) {
            const categorySelects = [
                document.getElementById('productCategory'),
                document.getElementById('editProductCategory'),
                document.getElementById('categoryFilter')
            ];

            const options = result.categories.map(category =>
                `<option value="${category.CategoryID}">${category.Category_Name}</option>`
            ).join('');

            categorySelects.forEach(select => {
                if (select) {
                    select.innerHTML = '<option value="">Select Category</option>' + options;
                }
            });

            const categoriesTableBody = document.getElementById('categoriesTableBody');
            if (categoriesTableBody) {
                categoriesTableBody.innerHTML = result.categories.map(category => `
                    <tr>
                        <td>${category.CategoryID}</td>
                        <td>${category.Category_Name}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="editCategory(${category.CategoryID}, '${category.Category_Name}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${category.CategoryID})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        } else {
            showAlert('danger', 'Failed to load categories');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showAlert('danger', 'Error loading categories');
    }
}

document.getElementById('addCategoryForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const categoryName = document.getElementById('newCategoryName').value;
    const addCategoryBtn = document.getElementById('addCategoryBtn');

    try {
        addCategoryBtn.disabled = true;
        addCategoryBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Adding...';

        const result = await window.api.callApi('POST', '/category/add', {
            name: categoryName
        });

        if (result.success) {
            showAlert('success', 'Category added successfully');
            document.getElementById('addCategoryForm').reset();
            await loadCategories();
        } else {
            showAlert('danger', result.message || 'Failed to add category');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        showAlert('danger', 'Error adding category');
    } finally {
        addCategoryBtn.disabled = false;
        addCategoryBtn.innerHTML = '<i class="fas fa-plus me-1"></i> Add';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
});