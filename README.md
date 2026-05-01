# 湘泰物流系统

## 环境要求

- Node.js `>= 20.9`
- npm `>= 10`

## 环境变量

先复制示例环境变量文件：

```bash
cp .env.example .env.local
```

关键变量说明：

- `DATABASE_URL`：SQLite 数据库地址；本地开发可使用 `file:./dev.db`
- `AUTH_SECRET`：会话签名密钥；生产环境必须配置为高强度随机值
- `NEXTAUTH_SECRET`：兼容旧配置名；已设置 `AUTH_SECRET` 时可不填

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

如需固定端口 `3001`：

```bash
npm run dev:3001
```

打开 [http://localhost:3000](http://localhost:3000) 或 [http://localhost:3001](http://localhost:3001) 查看页面。

## 构建

生产构建命令：

```bash
npm run build
```

当前项目使用 `webpack` 进行 Next.js 构建，以规避本地 `Turbopack` 构建异常。

本地预览已构建产物时，请使用：

```bash
npm run start:local
```

说明：

- `npm start` 用于生产启动，会先做环境变量校验并执行 `prisma migrate deploy`
- `npm run start:local` 用于本地预览已构建产物，不触发生产迁移流程，可避免本地旧 `dev.db` 的迁移历史冲突

## 本地测试账号

如需创建本地验证账号，需要显式确认并提供密码环境变量：

```bash
export ACCOUNT_OPS_CONFIRM=YES
export SEED_ADMIN_PASSWORD='你的管理员密码'
export SEED_STAFF_PASSWORD='你的员工密码'
export SEED_CLIENT_PASSWORD='你的客户密码'
npm run seed:users
```

Windows PowerShell 可使用：

```powershell
$env:ACCOUNT_OPS_CONFIRM="YES"
$env:SEED_ADMIN_PASSWORD="你的管理员密码"
$env:SEED_STAFF_PASSWORD="你的员工密码"
$env:SEED_CLIENT_PASSWORD="你的客户密码"
npm run seed:users
```

该脚本仅用于本地开发验证，不应作为生产环境初始化方式，也不再内置默认密码。

高风险账号维护脚本同样需要设置 `ACCOUNT_OPS_CONFIRM=YES` 后才可执行，例如：

```bash
npx tsx scripts/reset-password.ts <登录名> <新密码>
```

## 生产部署注意事项

- 生产环境必须显式配置 `AUTH_SECRET`
- 生产环境必须显式配置 `DATABASE_URL`
- 缺少以上变量时，生产环境会直接启动失败，而不会再回退到开发默认值
- 不要通过 HTTP 接口、登录链路或 seed 自动创建默认管理员
- `api/debug/system-check` 仅允许开发环境使用，生产环境会返回 `404`
- 如需初始化账号，请使用离线脚本或受控运维流程
