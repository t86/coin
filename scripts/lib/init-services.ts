// CommonJS version for scripts
const DataSyncService = require('../../src/lib/data-sync-service');
const { getDatabase } = require('../../src/lib/database');

async function initializeServices() {
    try {
        console.log('Initializing services...');
        const db = await getDatabase();
        console.log('Database initialized');
        const syncService = await DataSyncService.getInstance();
        await syncService.startSync();
        console.log('Data sync service started');
        return { db, syncService };
    } catch (error) {
        console.error('Error initializing services:', error);
        throw error;
    }
}

module.exports = { initializeServices }; 