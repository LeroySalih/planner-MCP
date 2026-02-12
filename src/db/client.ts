import { Pool } from 'pg';
import config from '../config';

class DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Database query error', { text: text.substring(0, 100), error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('Database connected successfully:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database pool closed');
  }
}

export const db = new DatabaseClient();
