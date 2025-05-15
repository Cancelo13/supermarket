const sql = require("mssql");
const serverName = process.env.SERVER_NAME || 'localhost';
const userInstanceName = process.env.INSTANCE_NAME || 'SQLEXPRESS';
const userName = process.env.USER_NAME || 'sa';
const userPassword = process.env.USER_PASSWORD || 'admin123';
const config = {
    server: serverName,
    database: 'master',
    user: userName,
    password: userPassword,
    options: {
        instanceName: userInstanceName,
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

async function executeQuery(query, params = []) {
    try {
        const pool = await getAppPool();
        const request = pool.request();

        if (params && params.length) {
            params.forEach(param => {
                request.input(param.name, param.value);
            });
        }

        const result = await request.query(query);
        return { status: 200, data: result };
    } catch (err) {
        console.error("Query execution error: ", err);
        return {
            status: 500, message: "Query execution failed", error: err.message
        }
    }
}

async function closePool() {
    try {
        if (appPoolPromise) {
            await appPoolPromise.close();
            appPoolPromise = null;
            console.log("SupermarketDB connection closed");
        }
    }
    catch (err) {
        console.error("Error closing SupermarketDB connection: ", err);
    }
}

module.exports = { sql, getPool, getAppPool, executeQuery };