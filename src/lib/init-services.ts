import DataSyncService from './data-sync-service.js';
import { getDatabase } from './database.js';

export async function initializeServices() {
    try {
        console.log('Initializing services...');

        // 初始化数据库
        const db = await getDatabase();
        console.log('Database initialized');

        // 初始化数据同步服务
        const syncService = await DataSyncService.getInstance();
        await syncService.startSync();
        console.log('Data sync service started');

        return { db, syncService };
    } catch (error) {
        console.error('Error initializing services:', error);
        throw error;
    }
}
