import mysql from 'mysql2/promise';

class DatabaseService {
    private connection: mysql.Connection | null = null;

    async connect(config: mysql.ConnectionOptions): Promise<void> {
        this.connection = await mysql.createConnection(config);
    }

    async query(sql: string, params: any[] = []): Promise<any> {
        if (!this.connection) {
            throw new Error('Database connection is not established.');
        }
        const [results] = await this.connection.execute(sql, params);
        return results;
    }

    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}

export default new DatabaseService();