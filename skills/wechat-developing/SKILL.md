---
name: wechat-developing
description: "Field notes for building on the WeChat ecosystem, one reference file per area. Covers 公众号 H5 today: JS-SDK share cards, jsapi_ticket signing, API IP whitelist, JS 接口安全域名, JSAPI pay, and Aliyun mainland ICP (备案) interception of pages and payment callbacks. Use when the user mentions 微信开发, 公众号, 微信分享卡片, wx.config, 签名接口, jsapi_ticket, access_token, errcode 40164, IP 白名单, 安全域名, 微信开发者平台, 微信支付回调, 备案拦截, 分享出去只有链接, or asks to verify a WeChat feature before writing a changelog."
---

# WeChat Developing

WeChat features depend on console settings as much as on code. Most failures come from those settings and fail silently: WeChat falls back to its default behavior, and the page shows no error. This skill collects verified field notes, one reference file per area.

## When to Use

- Building, debugging, or accepting anything that runs inside WeChat or talks to WeChat servers.
- A shared link shows only the URL, with no title, description, or cover.
- Logs show `errcode 40164` / `invalid ip ... not in whitelist`.
- A new server (staging, a new region, a new egress IP) or a new domain starts serving WeChat traffic.
- A page on an Aliyun mainland server works in one browser but fails in `curl`, another client, or a payment callback.
- A changelog or acceptance report is about to claim WeChat behavior.

## How It Works

### Topic map

Read the file for the area at hand. Do not load the others.

| Area | File | Covers |
| --- | --- | --- |
| 公众号 H5 | `references/official-account-h5.md` | Share-card chain, signature, token and ticket caching, console settings, JSAPI pay, acceptance checks |
| Mainland hosting | `references/mainland-hosting.md` | Aliyun ICP (备案) interception, why new Chrome passes, which clients and callbacks still fail |

### Rules for every area

1. **Settings are independent.** API IP whitelist, JS 接口安全域名, OAuth domain, and payment notify URL are separate settings. Never infer one from another. Open the console and read the real list.
2. **Every environment is its own case.** Staging and production have different egress IPs and domains. A pass on one proves nothing for the other.
3. **The user does the QR scans.** WeChat consoles need QR login, and some saves need an admin scan. Drive the browser, and tell the user up front how many scans are needed.
4. **Verify on a real phone before claiming.** Checking HTML, a direct API call, or a desktop browser proves only part of the chain. Do not write WeChat behavior into a changelog or report until the phone check passes and backend logs show the matching request. If a claim went out early, say so and hold it.
5. **Do not trust the terminal alone for reachability.** The terminal and the user's browser may take different network paths and TLS behavior. Test in the user's browser and in WeChat.
6. **Copy wording.** In voting or contest pages, say 「复制作品链接」, not 「拉票链接」: 「拉票」 reads as encouraging vote canvassing (刷票). Avoid 诱导分享 phrasing such as 「转发给好友帮我投票」; WeChat's external-link rules penalize it.

### Adding an area

- One file per area under `references/` (for example 小程序, 企业微信, 开放平台, 微信支付 V3).
- Add a row to the topic map and the area's trigger words to `description`.
- Only add notes verified in a real session. Replace project AppIDs, IPs, and domains with placeholders such as `wx<appid>`, `<egress-ip>`, and `example.com`.

## Examples

**Shared link shows only the URL.** Read `references/official-account-h5.md`, then follow "Debugging a bare-link card": call the signature endpoint, read the 40164 error for the caller IP, add it on 微信开发者平台 with the user's QR scans, and finish with the three acceptance checks.

**Moving an H5 to a new staging server.** Add the server's egress IP to the API IP whitelist. Check whether a registered parent domain already covers the new subdomain. If the server is in an Aliyun mainland region, read `references/mainland-hosting.md` and keep payment notify URLs on a filed domain.

**"Works in my browser, `curl` gets reset."** Read `references/mainland-hosting.md` and run the two-group OpenSSL check before concluding anything about 备案.
