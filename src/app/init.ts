import { initializeServices } from '@/lib/init-services';

// 在应用启动时初始化服务
export async function initApp() {
    try {
        console.log('Initializing application services...');
        await initializeServices();
        console.log('Application services initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application services:', error);
        // 不抛出错误，让应用继续运行，服务会在后台继续尝试初始化
    }
}

// 启动初始化
initApp();
