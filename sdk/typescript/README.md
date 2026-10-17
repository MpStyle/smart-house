# Smart House TypeScript SDK

Independent Fetch client generated from the Smart House OpenAPI contract. Includes ESM JavaScript and TypeScript declarations; requires native Fetch or an injected Fetch implementation.

```typescript
import { SmartHouseClient } from '@mpstyle/smart-house-sdk';

const client = new SmartHouseClient(window.location.origin);
const session = await client.session();
```

Use the deployment origin without `/api/v1`. Protected methods require an authenticated same-origin session cookie. Sign in through browser navigation to `/api/v1/auth/login`, then retrieve the authenticated session's CSRF token before calling `logout`. Node.js callers must provide authenticated cookie handling through the optional `http` constructor argument.

See the [SDK guide](https://github.com/MpStyle/smart-house/blob/main/sdk/README.md) for authentication, C# usage, regeneration, GitHub Packages configuration, and tagged releases.
