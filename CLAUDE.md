# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CloudFlare ImgBed 是一个基于 Cloudflare Pages 的免费文件托管解决方案，支持多种存储渠道（Telegram、R2、S3等），提供文件上传、管理、读取、删除等全链路功能。

## 开发环境命令

### 本地开发
```bash
# 启动本地开发服务器（包含KV和R2模拟）
npm start

# 运行测试
npm test

# CI测试（启动服务器并运行测试）
npm run ci-test
```

### 部署相关
- 项目通过 Cloudflare Pages 部署
- 构建命令：`npm install`
- 环境变量通过 Pages 控制台配置

## 架构结构

### 核心目录结构
- `functions/` - Cloudflare Pages 函数
  - `api/` - API 接口
    - `manage/` - 管理端接口
    - `*_middleware.js` - 中间件
  - `upload/` - 上传相关功能
  - `file/` - 文件访问功能
  - `utils/` - 工具函数
  - `dav/` - WebDAV 协议支持
  - `random/` - 随机文件接口
- `database/` - 数据库相关文件
  - `schema.sql` - D1 数据库表结构
  - `init.sql` - 初始化数据
- 前端资源在根目录（已构建的静态文件）

### 数据库架构
项目使用数据库适配器模式，支持：
- **KV 存储**：用于简单部署，兼容性最好
- **D1 数据库**：功能更强大，支持复杂查询和索引

主要数据表：
- `files` - 文件元数据
- `settings` - 系统配置
- `index_operations` - 索引操作记录
- `index_metadata` - 索引元信息
- `other_data` - 其他数据（黑名单等）

### 核心功能模块

#### 上传系统 (`functions/upload/`)
- `uploadTools.js` - 上传核心工具函数
- `chunkUpload.js` - 分块上传
- `chunkMerge.js` - 分块合并
- 支持多种存储渠道的负载均衡

#### 文件管理 (`functions/api/manage/`)
- 用户认证和权限管理
- 文件列表、删除、移动
- 系统配置管理
- API Token 管理

#### 工具函数 (`functions/utils/`)
- `databaseAdapter.js` - 数据库适配器
- `middleware.js` - 中间件工具
- `sysConfig.js` - 系统配置
- `indexManager.js` - 索引管理
- `telegramAPI.js` - Telegram 集成

## 存储渠道

项目支持多种存储渠道：
1. **Telegram Channel** - 默认渠道，通过 Bot API
2. **Cloudflare R2** - 对象存储
3. **AWS S3** - 兼容 S3 的存储服务
4. **WebDAV** - WebDAV 协议支持

## 重要配置

### 环境变量
- `img_url` - KV 存储绑定
- `img_d1` - D1 数据库绑定
- `img_r2` - R2 存储绑定
- `TG_BOT_TOKEN` - Telegram Bot Token
- `TG_CHAT_ID` - Telegram Chat ID
- `dev_mode` - 开发模式标识

### 文件命名策略
通过 `uploadNameType` 参数控制：
- `default` - 时间戳_原文件名
- `index` - 时间戳索引
- `origin` - 保持原文件名
- `short` - 短链接（8位随机字符）

## 安全特性

- IP 地址黑名单/白名单
- 文件内容审查（moderatecontent.com、nsfwjs）
- 上传权限控制
- API Token 认证

## 开发注意事项

1. **数据库兼容性**：使用 `getDatabase(env)` 获取数据库实例，自动适配 KV/D1
2. **中间件**：API 路由使用 `_middleware.js` 进行统一处理
3. **错误处理**：使用 `createResponse()` 函数统一响应格式
4. **缓存管理**：上传后需要清除 CDN 缓存和 API 缓存
5. **索引维护**：文件操作后需要更新搜索索引

## 测试

项目使用 Mocha 进行测试：
```bash
npm test          # 运行所有测试
npm run ci-test   # 启动服务器并运行测试
```

## 部署要求

1. 配置 Cloudflare Pages 项目
2. 绑定必要的资源（KV/D1/R2）
3. 设置环境变量
4. 配置自定义域名（可选）
5. 构建命令：`npm install`