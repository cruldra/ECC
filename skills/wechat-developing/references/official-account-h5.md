# 公众号 H5 (Official Account Web Pages)

A 公众号 H5 page is a normal web page opened inside WeChat's in-app browser. Share cards, JSAPI pay, and OAuth login depend on console settings as much as on code.

## Share-card chain

```text
page URL (no #)
  -> backend signature endpoint
     -> access_token   (cgi-bin/token; caller IP must be whitelisted)
     -> jsapi_ticket   (cgi-bin/ticket/getticket?type=jsapi)
     -> sha1 signature
  -> wx.config -> wx.ready
  -> updateAppMessageShareData / updateTimelineShareData
```

A break anywhere gives the default card: a bare link, no title, no cover. Page `<title>` and `<meta>` / Open Graph tags do not rescue it. Tags present in the HTML prove nothing about the card.

Rules:

- Sign exactly `location.href.split('#')[0]`. Pass the same string to the backend (URL-encoded in the query) and to `link` in the share data.
- Signature = `sha1("jsapi_ticket=<ticket>&noncestr=<nonce>&timestamp=<ts>&url=<url>")`. Keep the key order. Use the raw URL, not the encoded one.
- Cache `access_token` and `jsapi_ticket` on the server. Both live 7200 s; cache about 6600 s. A new `access_token` invalidates the old one, so refresh under a distributed lock, one lock per cache key. Fetch the token before taking the ticket lock; never hold both.
- On the page, run only when the user agent matches `/micromessenger/i`. Load `https://res.wx.qq.com/open/js/jweixin-1.6.0.js`. Swallow every error: a failed card must not break the page.

Reference backend (Python):

```python
def compute_signature(ticket: str, noncestr: str, timestamp: str, url: str) -> str:
    raw = f"jsapi_ticket={ticket}&noncestr={noncestr}&timestamp={timestamp}&url={url}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


async def build_jsconfig(url: str) -> dict:
    ticket = await get_jsapi_ticket()  # cached + locked refresh
    noncestr = secrets.token_hex(8)
    timestamp = str(int(time.time()))
    return {
        "appId": settings.WECHAT_MP_APP_ID,
        "timestamp": timestamp,
        "nonceStr": noncestr,
        "signature": compute_signature(ticket, noncestr, timestamp, url),
    }
```

Reference page (TypeScript):

```ts
export const setupWeChatShare = async ({ title, desc, imgUrl }: WxShare) => {
  if (!/micromessenger/i.test(navigator.userAgent)) return;
  const link = window.location.href.split("#")[0];
  try {
    await loadJweixin();
    const res = await fetch(`/api/wechat/jssdk-signature?url=${encodeURIComponent(link)}`);
    if (!res.ok) return;
    const cfg = await res.json();
    window.wx.config({ debug: false, ...cfg, jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"] });
    window.wx.ready(() => {
      window.wx.updateAppMessageShareData({ title, desc, link, imgUrl });
      window.wx.updateTimelineShareData({ title, link, imgUrl });
    });
  } catch {
    /* a failed card must not break the page */
  }
};
```

## Console settings

| Setting | Needed for | Where | Failure |
| --- | --- | --- | --- |
| API IP 白名单 | Every server that calls `cgi-bin/token`, including staging | 微信开发者平台 (moved out of the 公众号 admin's 「基本配置」) | `{"errcode":40164,"errmsg":"invalid ip <ip> ... not in whitelist"}`, signature endpoint 500 |
| JS 接口安全域名 | Domains that call `wx.config` | Shown next to the IP whitelist on 微信开发者平台; historically 「公众号设置 → 功能设置」 | `wx.config` fails, default card |
| 网页授权域名 (OAuth) | WeChat login redirect | Separate setting | Login redirect error |
| 支付回调 / notify URL | WeChat Pay server-to-server callback | 商户平台 / order request | Paid orders never marked paid |

- 微信开发者平台 needs its own QR login, separate from the 公众号 admin login. Then open 控制台, pick the 公众号, and open its development settings.
- Saving the IP whitelist pops 「管理员扫码授权设置 API IP 白名单」. A 公众号 admin must scan it. Tell the user up front that one scan is needed.
- Find the missing IP from the 40164 error text itself; it names the caller IP. Every environment has its own egress IP, so a pass on production says nothing about staging.
- A registered parent domain (`example.com`) covers its subdomains (`staging.example.com`) for JS 接口安全域名. Read the real list before adding entries.

## JSAPI pay

- JSAPI pay does not use `wx.config` or `jsapi_ticket`. Wait for `WeixinJSBridgeReady`, then call `WeixinJSBridge.invoke("getBrandWCPayRequest", params, cb)` with all six params (`appId`, `timeStamp`, `nonceStr`, `package`, `signType`, `paySign`). If one is missing, fail before calling WeChat.
- Map `err_msg` strictly: `get_brand_wcpay_request:ok` and `:cancel`; anything else is a failure.
- `ok` is not proof of payment. Order status comes only from the server notify or an order query.
- Keep the notify URL on a domain that server-to-server callers can reach. See `mainland-hosting.md`.

## Acceptance checks

A share card is accepted only after all three checks:

1. The signature endpoint called directly with `?url=<page url>` returns 200 with `appId`, `timestamp`, `nonceStr`, `signature`. This proves only the token and ticket step.
2. On a real phone, open the link in WeChat, tap 「…」, and share to a chat and to 朋友圈. Title, description, and cover all show.
3. Backend logs show that share's signature request: status 200, and the page domain it came from.

## Debugging a bare-link card

1. Call the signature endpoint for that page URL. A 500 means the backend chain broke.
2. Read the backend log. `errcode 40164` names the caller IP.
3. Ask the user for a 微信开发者平台 QR login, add the IP, and have an admin scan the authorization.
4. Call the endpoint again (expect 200). Then ask the user to share from WeChat on a phone, and confirm the matching 200 in the backend log.
