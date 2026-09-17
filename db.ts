import sql from 'mssql';
import { getSecrets } from './secrets.js';

let sqlPool: sql.ConnectionPool | null = null;
let poolConnecting: Promise<sql.ConnectionPool> | null = null;
let currentSqlConfig: string | null = null;

export async function getSqlPool(config: sql.config): Promise<sql.ConnectionPool> {
  const configStr = JSON.stringify(config);

  // If config changed → reset pool
  if (currentSqlConfig !== configStr) {
    if (sqlPool) {
      try { await sqlPool.close(); } catch {}
    }
    sqlPool = null;
    poolConnecting = null;
    currentSqlConfig = configStr;
  }

  // If already connected → return
  if (sqlPool && sqlPool.connected) {
    return sqlPool;
  }

  // If connection in progress → await it
  if (poolConnecting) {
    return poolConnecting;
  }

  // Otherwise create new connection (with retry)
  poolConnecting = (async () => {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔌 Connecting to SQL Server (attempt ${attempt})...`);
        const pool = new sql.ConnectionPool(config);

        // Listen to connection/pool level errors and reset sqlPool if active
        pool.on('error', (err) => {
          console.error('SQL Server Connection Pool Error:', err);
          if (sqlPool === pool) {
            console.log('Resetting cached SQL Pool due to connection error.');
            sqlPool = null;
          }
        });

        await pool.connect();

        console.log('✅ SQL Server connected');
        sqlPool = pool;
        poolConnecting = null;
        return pool;
      } catch (err) {
        console.error(`❌ SQL connection failed (attempt ${attempt})`);

        if (attempt === maxRetries) {
          poolConnecting = null;
          throw err;
        }

        await new Promise(r => setTimeout(r, 2000));
      }
    }

    throw new Error('Unexpected SQL connection failure');
  })();

  return poolConnecting;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  const secrets = getSecrets();
  const serverRaw = (secrets.SQL_SERVER_SERVER || '').trim();
  const [host, instance] = serverRaw.split('\\');
  const sqlConfig: sql.config = {
    user: (secrets.SQL_SERVER_USER || '').trim(),
    password: (secrets.SQL_SERVER_PASSWORD || '').trim(),
    server: host,
    database: (secrets.SQL_SERVER_DATABASE || '').trim(),
    port: parseInt(secrets.SQL_SERVER_PORT || '1433'),
    options: {
      encrypt: true,
      trustServerCertificate: secrets.SQL_SERVER_TRUST_SERVER_CERTIFICATE !== 'false',
      instanceName: instance,
      connectTimeout: 15000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
  return await getSqlPool(sqlConfig);
}

