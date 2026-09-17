import snowflake from 'snowflake-sdk';
import { getSecrets } from './secrets.js';

export function getSnowflakeConnection(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    const secrets = getSecrets();
    const snowflakeConfig = {
      account: (secrets.SNOWFLAKE_ACCOUNT || '').trim(),
      username: (secrets.SNOWFLAKE_USERNAME || '').trim(),
      password: (secrets.SNOWFLAKE_PASSWORD || '').trim(),
      database: (secrets.SNOWFLAKE_DATABASE || '').trim(),
      schema: (secrets.SNOWFLAKE_SCHEMA || '').trim(),
      warehouse: (secrets.SNOWFLAKE_WAREHOUSE || '').trim(),
    };
    const connection = snowflake.createConnection(snowflakeConfig);
    connection.connect((err, conn) => {
      if (err) {
        return reject(err);
      }
      resolve(conn);
    });
  });
}
