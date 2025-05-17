const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    redirectTo: (page) => {
        const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
        window.location.href = `${currentDir}/${page}`;
    },
    callApi: async (method, endpoint, data) => {
        switch (endpoint) {
            case '/auth/login':
                return await ipcRenderer.invoke('auth:login', data);
            case '/auth/register':
                return await ipcRenderer.invoke('auth:register', data);
            case '/auth/current-user':
                return console.log('Fetching current user');
            case '/database/execute-query':
                const queryResult = await ipcRenderer.invoke('database:execute-query', data);
                return { status: queryResult.status ? 200 : 500, data: queryResult.data };
            case '/product/add':
                return await ipcRenderer.invoke('product:add', data);
            case '/category/add':
                return await ipcRenderer.invoke('category:add', data);
            case '/category/getAll':
                return await ipcRenderer.invoke('category:getAll');
            case '/product/update':
                return await ipcRenderer.invoke('product:update', data);
            case '/product/delete':
                return await ipcRenderer.invoke('product:delete', data);
            case '/inventory/getAll':
                return await ipcRenderer.invoke('inventory:getAll');
            case '/inventory/update':
                return await ipcRenderer.invoke('inventory:update', data);
            case '/inventory/getLowStock':
                return await ipcRenderer.invoke('inventory:getLowStock', data.threshold);
            case '/customer/getAll':
                return await ipcRenderer.invoke('customer:getAll');
            case '/customer/add':
                return await ipcRenderer.invoke('customer:add', data);
            case '/customer/update':
                return await ipcRenderer.invoke('customer:update', data);
            case '/customer/delete':
                return await ipcRenderer.invoke('customer:delete', data);
            case '/order/create':
                return await ipcRenderer.invoke('order:create', data);
            case '/voucher/getAvailable':
                return await ipcRenderer.invoke('voucher:getAvailable', data.customerId);
            case '/order/getAll':
                return await ipcRenderer.invoke('order:getAll');
            case '/order/update':
                return await ipcRenderer.invoke('order:update', data);
            case '/voucher/create':
                return await ipcRenderer.invoke('voucher:create', data);
            case '/voucher/update':
                return await ipcRenderer.invoke('voucher:update', data);
            case '/voucher/delete':
                return await ipcRenderer.invoke('voucher:delete', data);
            case '/dashboard/getSummaryStats':
                return await ipcRenderer.invoke('dashboard:getSummaryStats');
            case '/dashboard/getRecentOrders':
                return await ipcRenderer.invoke('dashboard:getRecentOrders');
            case '/dashboard/getTopProducts':
                return await ipcRenderer.invoke('dashboard:getTopProducts');
            case '/dashboard/getLowStockProducts':
                return await ipcRenderer.invoke('dashboard:getLowStockProducts');
            case '/admin/changePassword':
                return await ipcRenderer.invoke('admin:changePassword', data);
            case '/customer/orders':
                return await ipcRenderer.invoke('customer:getOrders', data.customerId);
            case '/customer/order/details':
                return await ipcRenderer.invoke('customer:getOrderDetails', data.orderId);
            case '/customer/dashboard/stats':
                return await ipcRenderer.invoke('customer:getDashboardStats', data.customerId);
            case '/customer/dashboard/featuredProducts':
                return await ipcRenderer.invoke('customer:getFeaturedProducts');
            case '/customer/dashboard/recentOrders':
                return await ipcRenderer.invoke('customer:getRecentOrders', data.customerId);
            case '/customer/profile/update':
                return await ipcRenderer.invoke('customer:updateProfile', data);
            case '/customer/profile/changePassword':
                return await ipcRenderer.invoke('customer:changePassword', data);
            case '/customer/profile/delete':
                return await ipcRenderer.invoke('customer:deleteAccount', data);
            default:
                return { status: 404, message: 'Endpoint not found' };
        }
    },
    database: {
        executeQuery: async (query, params = []) => {
            try {
                const result = await ipcRenderer.invoke('database:execute-query', {
                    query,
                    params
                });
                return {
                    success: true,
                    data: result.data,
                    rowsAffected: result.rowsAffected
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        executeBatch: async (queries) => {
            try {
                const result = await ipcRenderer.invoke('database:execute-batch', {
                    queries
                });
                return {
                    success: true,
                    results: result
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    getCurrentUser: async () => {
        return await ipcRenderer.invoke('auth:get-current-user');
    },
    logout: async () => {
        return await ipcRenderer.invoke('auth:logout');
    }
});
