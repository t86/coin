console.log('开始执行 sync-prices.ts');

async function main() {
    try {
        const { initializeServices } = await import('../src/lib/init-services.js');
        await initializeServices();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
