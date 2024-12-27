import { initializeServices } from '@/lib/init-services';

// 全局状态标志
declare global {
    var __servicesInitialized: boolean;
}

// 确保只初始化一次
if (!global.__servicesInitialized) {
    console.log('Starting service initialization...');
    initializeServices()
        .then(() => {
            global.__servicesInitialized = true;
            console.log('Services initialized successfully');
        })
        .catch((error) => {
            console.error('Failed to initialize services:', error);
        });
}

// 导出一个空的 GET 处理程序以满足 Next.js 的要求
export async function GET() {
    return new Response('System initialized', { status: 200 });
}
