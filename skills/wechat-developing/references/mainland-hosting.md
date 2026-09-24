# Mainland Hosting: Aliyun ICP (备案) Interception

A server in an Aliyun mainland region serving a domain that is not 备案接入 at Aliyun gets filtered. The filter reads the host name (SNI) from the first TLS packet: HTTPS is reset, and plain HTTP returns a 备案拦截 page.

## Why one client passes and another fails

- New Chrome sends a large post-quantum key share (`X25519MLKEM768`). The ClientHello splits into two TCP packets, the filter cannot read the host name, and the connection passes.
- So "works in my browser" and "`curl` fails" can both be true. The terminal and the user's browser may also take different network paths.

Reproduce both results with OpenSSL 3.5+:

```bash
for g in X25519 X25519MLKEM768; do
  printf 'GET / HTTP/1.1\r\nHost: staging.example.com\r\nConnection: close\r\n\r\n' |
    timeout 10 openssl s_client -quiet -connect staging.example.com:443 \
      -servername staging.example.com -groups "$g" 2>&1 | head -3
done
```

The `X25519` run is reset; the `X25519MLKEM768` run gets the page.

## Who is still at risk

- `curl`, old browsers, and other apps.
- Every server-to-server callback: WeChat Pay and Alipay notify, and any WeChat server push to your backend.
- WeChat's in-app browser passed in one test (2026-09). Re-check per client.

## Rules

- Callback URLs (payment notify, message push) must use a domain filed at the hosting provider, or a server outside the filter. Never a domain that only works in new Chrome.
- Do not conclude "needs 备案" or "blocked" from the terminal alone. Test in the user's browser and in WeChat before writing it down anywhere, including project notes and profiles.
