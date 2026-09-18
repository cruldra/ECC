# 交互原型脚手架

给甲方看的一次性原型。**不是正式代码，不会演进成正式代码。**
它只干一件事：让双方对「要解决什么问题」看法一致，并让甲方下决心。

## 跑起来

```bash
pnpm install
pnpm dev
```

## 加一屏

1. `src/data/<主题>.ts` 写死数据，所有示例值带「示例」二字
2. `src/scenes/<id>/index.tsx` 复制 `scene1`，套 `SceneShell`
3. `src/router.tsx` 的 `SCENES` 加一条

`SceneShell` 强制四段：**场景 → 痛点 → 解决方案 → 可点的交互演示**，末尾「请贵司确认」列我们没摸准、要当面问的问题。少一段编译不过。

## 红线

界面上、文案里、演示里一律不许出现：

- 工期承诺（几天、几周、几个月上线）
- 省钱金额、人力节省、ROI、回本周期
- 编的行业数据、编的同行案例
- 任何「一定」「保证」「必然」

原型是报价的**前提**，不是报价之后的活。先让他看见东西、点上手、承认这就是他要的，再谈钱。

## 不要的东西

后端、数据库、鉴权、状态管理库、CI、单元测试、错误上报。一样都不要。
跨页要记住状态就用 `localStorage`，假装有后端就够了。

## 部署

```bash
S=~/.agents/skills/deploying-to-dify-host/dify-deploy.sh
$S deploy <name> <sub> <port> <本地目录>
```

一条命令跑完 DNS → frpc → Caddy 证书 → 公网 HTTPS。不要手工改 Cloudflare、Caddyfile、重启 frp。
给客户的只有一条链接，他什么都不用装，手机也能开。
