import DataSyncService from './data-sync-service';

export async function initializeServices() {
    try {
        await DataSyncService.startSync();
        console.log('Data sync service started successfully');
    } catch (error) {
        console.error('Failed to start data sync service:', error);
    }
}
