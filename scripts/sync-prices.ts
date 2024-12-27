import { DataSyncService } from '../src/lib/data-sync-service.js';
import { getDatabase } from '../src/lib/database.js';

async function main() {
    try {
        // 初始化数据库
        const db = await getDatabase();
        console.log('Database initialized');

        // 启动数据同步服务
        const syncService = await DataSyncService.getInstance();
        await syncService.startSync();
        console.log('Data sync service started');

        // 运行一段时间后停止
        const duration = process.env.SYNC_DURATION ? parseInt(process.env.SYNC_DURATION) : 60 * 60 * 1000; // 默认运行1小时
        setTimeout(async () => {
            await syncService.stopSync();
            console.log('Data sync service stopped');
            process.exit(0);
        }, duration);
    } catch (error) {
        console.error('Error running sync script:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
