请使用中文回答
Every time you choose to apply a rule(s), explicitly state the rule(s) in the output. You can abbreviate the rule description to a single word or phrase.

Project Context
这是一个实时监控多个加密货币交易所价格的Web应用系统。通过整合多个主流交易所（包括Binance、OKEx和Bybit）的API，为用户提供实时的加密货币价格比较和监控功能。

## 主要功能
- 实时价格监控
- 多交易所价格比较
- 支持现货和永续合约市场
- 搜索和筛选功能
- 分页显示
- 自动刷新（10秒间隔）

Code Style and Structure
Write concise, technical TypeScript code with accurate examples
Use functional and declarative programming patterns; avoid classes
Prefer iteration and modularization over code duplication
Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
Structure repository files as follows:
coin/
├── src/                # 源代码目录
│   ├── app/           # Next.js应用主目录
│   ├── types/         # TypeScript类型定义
│   └── ...
├── data/              # 数据存储目录
├── public/            # 静态资源
└── config/            # 配置文件
Tech Stack
- **前端框架**：Next.js (最新版本)
- **开发语言**：TypeScript
- **UI框架**：Tailwind CSS
- **数据库**：SQLite3 (使用 better-sqlite3)
- **API集成**：ccxt (加密货币交易所集成库)
- **HTTP客户端**：axios
Naming Conventions
Use lowercase  for directories (e.g., api/binance)
Favor named exports for components and utilities
Use PascalCase for component files (e.g., PriceCard.tsx)
Use camelCase with slash separators for utility files (e.g., data-sync-service.ts)
TypeScript Usage
Use TypeScript for all code; prefer interfaces over types
Avoid enums; use const objects with 'as const' assertion
Use functional components with TypeScript interfaces
Define strict types for message passing between different parts of the extension
Use absolute imports for all files @/...
Avoid try/catch blocks unless there's good reason to translate or handle error in that abstraction
Use explicit return types for all functions
Use Manifest V3 standards
Implement proper message passing between components:
interface MessagePayload {
  type: string;
  data: unknown;
}
Implement proper error boundaries and fallbacks
Use lib/storage for storage related logic
For the async injected scripts in content/,
they must not close over variables from the outer scope
they must not use imported functions from the outer scope
they must have wrapped error handling so the error message is returned to the caller
State Management
Use React Context for global state when needed
Implement proper cleanup in useEffect hooks
Syntax and Formatting
Use "function" keyword for pure functions
Avoid unnecessary curly braces in conditionals
Use declarative JSX
Implement proper TypeScript discriminated unions for message types
UI and Styling
Use Shadcn UI and Radix for components
use npx shadcn@latest add <component-name> to add new shadcn components
Implement Tailwind CSS for styling
Consider extension-specific constraints (popup dimensions, permissions)
When adding new shadcn component, document the installation command
Error Handling
Implement proper error boundaries
Log errors appropriately for debugging
Provide user-friendly error messages
Handle network failures gracefully
Testing
Write unit tests for utilities and components
Implement E2E tests for critical flows
Test memory usage and performance
Security
Implement Content Security Policy
Sanitize user inputs
Handle sensitive data properly
Implement proper CORS handling
Git Usage
Commit Message Prefixes:

"fix:" for bug fixes
"feat:" for new features
"perf:" for performance improvements
"docs:" for documentation changes
"style:" for formatting changes
"refactor:" for code refactoring
"test:" for adding missing tests
"chore:" for maintenance tasks
Rules:

Use lowercase for commit messages
Keep the summary line concise
Include description for non-obvious changes
Reference issue numbers when applicable
Documentation
Maintain clear README with setup instructions
Document API interactions and data flows
Don't include comments unless it's for complex logic
Document permission requirements
Development Workflow
Use proper version control
Implement proper code review process
Test in multiple environments
Follow semantic versioning for releases
Maintain changelog