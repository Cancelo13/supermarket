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
