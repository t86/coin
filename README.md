# 加密货币价格监控系统

## 项目简介
这是一个实时监控多个加密货币交易所价格的Web应用系统。通过整合多个主流交易所（包括Binance、OKEx和Bybit）的API，为用户提供实时的加密货币价格比较和监控功能。

## 技术栈
- **前端框架**：Next.js (最新版本)
- **开发语言**：TypeScript
- **UI框架**：Tailwind CSS
- **数据库**：SQLite3 (使用 better-sqlite3)
- **API集成**：ccxt (加密货币交易所集成库)
- **HTTP客户端**：axios

## 主要功能
- 实时价格监控
- 多交易所价格比较
- 支持现货和永续合约市场
- 搜索和筛选功能
- 分页显示
- 自动刷新（10秒间隔）

## 项目结构
```
coin/
├── src/                # 源代码目录
│   ├── app/           # Next.js应用主目录
│   ├── types/         # TypeScript类型定义
│   └── ...
├── data/              # 数据存储目录
├── public/            # 静态资源
└── config/            # 配置文件
```

## 环境要求
- Node.js (最新LTS版本)
- npm 或 yarn
- SQLite3

## 安装和运行
1. 克隆项目
```bash
git clone [项目地址]
cd coin
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 构建生产版本
```bash
npm run build
npm start
```

## 配置说明
- 在使用前需要配置各交易所的API密钥（如需要）
- 可通过环境变量配置代理设置
- 数据库配置位于项目配置文件中

## 开发规范
- 使用ESLint进行代码规范检查
- 遵循TypeScript严格模式
- 使用Prettier进行代码格式化
- 组件采用函数式编程方式
- 使用React Hooks管理状态

## 注意事项
- API请求可能受到交易所访问限制
- 建议配置适当的代理服务
- 价格数据仅供参考，交易请以交易所实际价格为准

## 贡献指南
欢迎提交Issue和Pull Request，请确保：
- 代码符合项目规范
- 提供完整的测试用例
- 更新相关文档

## 许可证
MIT License

## 联系方式
如有问题或建议，请提交Issue或联系项目维护者。