interface CacheItem<T> {
    data: T;
    timestamp: number;
}

interface CacheOptions {
    ttl: number;  // Time to live in milliseconds
}

class Cache {
    private static instance: Cache;
    private cache: Map<string, CacheItem<any>>;
    
    private constructor() {
        this.cache = new Map();
    }

    public static getInstance(): Cache {
        if (!Cache.instance) {
            Cache.instance = new Cache();
        }
        return Cache.instance;
    }

    set<T>(key: string, data: T, options: CacheOptions): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        // 设置过期清理
        if (options.ttl > 0) {
            setTimeout(() => {
                this.delete(key);
            }, options.ttl);
        }
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }
        return item.data;
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

export const cache = Cache.getInstance();

export async function withCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = { ttl: 5 * 60 * 1000 }  // 默认5分钟
): Promise<T> {
    const cachedData = cache.get<T>(key);
    if (cachedData !== null) {
        return cachedData;
    }

    const data = await fetchFn();
    cache.set(key, data, options);
    return data;
}
