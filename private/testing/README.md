# Local Smoke Testing

`smoke-macos.sh` is the fast local harness for the umbrella-owned Feishu extension.

What it does:

1. creates a temporary `CTI_HOME`
2. starts a local fake webhook server
3. writes a temporary menu-route config pointing at that server
4. starts the bridge through `private/runtime/bridge.sh`
5. verifies the private extension logged its startup
6. injects a representative menu event through `PrivateFeishuAdapter.handleMenuEvent()`
7. asserts the fake webhook server received the POST

Run it from the umbrella repo root:

```bash
bash private/testing/smoke-macos.sh
```

This smoke harness does not require live Feishu credentials. The menu click is injected through the private adapter test seam so the local loop validates runner wiring, config loading, and webhook emission without depending on the Feishu network edge.
