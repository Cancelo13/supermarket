const sql = require("mssql");
const config = {
    server: 'MOHAMED',
    database: 'master',
    user: 'sa',
    password: 'admin123',
    options: {
        instanceName: 'SQLEXPRESS',
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
};

const appConfig = {
    ...config,
    database: 'SupermarketDB'
};

let poolPromise = null;
function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config)
            .then(pool => {
                console.log("Connected to database");
                return pool;
            })
            .catch(err => {
                console.error("Database connection failed: ", err);
                throw err;
            });
    }
    return poolPromise;
}

let appPoolPromise = null;
function getAppPool() {
    if (!appPoolPromise) {
        appPoolPromise = sql.connect(appConfig)
            .then(pool => {
                console.log("Connected to SupermarketDB database");
                return pool;
            })
            .catch(err => {
                console.error("SupermarketDB connection failed: ", err);
                throw err;
            });
    }
    return appPoolPromise;
}

module.exports = { sql, getPool, getAppPool };