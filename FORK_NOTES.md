# feature 上游更新迁移记录

此次以 MarSeventh/CloudFlare-ImgBed 的 `ee8cce300e50946e1746228e00b704c216edd5b8`
（package.json 版本 2.7.6）为代码基础，迁移本 fork 的兼容性修改。
仅更新本 fork 的 feature，不向上游提交 PR，不修改本 fork 的 main。

## 备份与历史

- 原 feature：`171eb6837f59361e16e8a49afdad3c5754a551c7`。
- 备份分支：`backup/feature-before-upstream-20260905`。
- 整合提交保留原 feature 和上游提交作为两个父提交，避免强制推送和丢失历史。
- 旧版 README 精简、pnpm 锁文件、前端编译产物和部署说明保留在备份中；
  新版采用上游完整配套的前端、npm workspaces、package-lock.json 和部署结构，
  不混用旧版资源，也不迁回旧 AWS SDK 的打包规避配置。

## 保留的兼容性行为

- API、上传、文件路由在数据库和认证检查之前响应 OPTIONS 预检。
- 允许 Content-Type、Authorization、authCode 请求头；实际请求仍执行上游认证。
- 对正常响应、认证失败、数据库错误响应统一补充 CORS 头，同时保留状态码和缓存头。
- 不启用 Access-Control-Allow-Credentials；跨域客户端应使用 API Token，不依赖跨域 Cookie。
- 删除接口的缓存清理 URL 按路径段编码，兼容中文、空格、#、?、% 和多级目录。

## Cloudflare Pages 部署检查

新版前端位于 `frontend-dist`，不再位于仓库根目录。

- 仓库根目录保持项目根目录；Functions 仍位于根目录的 `functions`。
- 构建输出目录设置为 `frontend-dist`。
- 使用 npm 和上游锁文件安装依赖，例如构建命令 `npm ci`。
- 保留现有 KV/D1/R2 绑定和环境变量；不要新建空数据库替代原绑定。
- 这次 Git 更新不会修改 Cloudflare 控制台配置、数据库内容或凭据。
- 如果 feature 是自动部署分支，推送可能触发部署；上线后检查登录、上传、旧链接、删除和跨域客户端。
- 数据库应另行备份；Git 分支备份只备份代码，不备份数据库。

上游 workflows 保持原样。其 main 触发及默认分支定时任务不应被当作 feature 的自动更新机制。

## 本地兼容性测试

```sh
node --test tests/fork-compat.test.mjs
```

本次验证：8 项兼容性单元测试通过；API、upload、file 实际中间件的预检和
缺少数据库绑定响应检查通过；首页 7 个本地资源引用存在；Pages Functions
完整编译及 Workers deploy --dry-run 打包通过。未连接生产数据库，未执行生产
登录、真实上传或删除测试，也未执行实际 Cloudflare 部署。

## 回滚

如需回退，可在 Cloudflare 回滚到更新前的成功部署，或在确认备份和目标分支后
为整合提交创建 revert 提交（第一父提交是旧 feature）。不要直接强制覆盖分支。
代码回滚不能恢复部署后改变的数据库数据。
