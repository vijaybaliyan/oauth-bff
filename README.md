# OAuth BFF (Backend For Frontend) Demo

This demo showcases how to implement an **OAuth browser-based flow** using the **BFF (Backend For Frontend)** pattern.

🔗 Reference: [OAuth 2.0 for Browser-Based Apps - BFF](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps#name-backend-for-frontend-bff)

---

## 🧩 Architecture

To share the authentication session across applications, this setup uses a **shared domain cookie** at `.test.com` between front end and back end.

- **Frontend:** `https://app.test.com`
- **Backend (BFF Proxy):** `https://api.test.com`
- **Resource Server:** https://graph.microsoft.com

The resource server used in this demo is Microsoft Graph API:  
`https://graph.microsoft.com`

---

## 🔧 Endpoints

| Endpoint        | Description |
|----------------|-------------|
| `/session`     | Validates the `session_id` cookie. If valid, returns success. If invalid, returns an OIDC authorization challenge URL for redirect. |
| `/logout`      | Destroys the session both server-side and client-side (removes cookie). |
| `/callback`    | Handles the OIDC authorization callback. Exchanges the code, sets the session cookie, and stores access/refresh tokens in cache. |
| `/resource/*`  | Proxies requests to the resource server after validating the session and injecting the access token. |

---

## 📈 Flow Summary

1. User visits `https://app.test.com`.
2. Frontend checks `/session` on `https://api.test.com`:
    - If not logged in, it redirects the browser to the OIDC authorization endpoint.
3. After login, user is redirected to `https://api.test.com/callback`.
4. BFF processes the callback, sets a secure `session_id` cookie on `.test.com`, and redirects to frontend.
5. Frontend makes API calls (e.g., user info) to `/resource/*`, which BFF proxies to Microsoft Graph API using cached tokens.

---

## 🧪 Generate Self-Signed Certificate for Local Testing

### A. Create SSL Artifacts with OpenSSL

```bash
mkdir ssl
cd ssl

# Step 1: Generate private key
openssl genrsa -out test.key 2048

# Step 2: Create certificate signing request
openssl req -new -key test.key -out test.csr \
  -subj "/C=IN/ST=State/L=City/O=TestOrg/OU=Dev/CN=*.test.com"
```

### B. Create `san.cnf` for SubjectAltName

```ini
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = *.test.com
DNS.2 = api.test.com
DNS.3 = app.test.com
```

### C. Generate Self-Signed Certificate

```bash
openssl x509 -req -in test.csr -signkey test.key -out test.crt -days 365 \
  -extensions v3_req -extfile san.cnf
```

📌 *If OpenSSL is not installed: [Download here](https://slproweb.com/products/Win32OpenSSL.html)*

---

## 🛠️ Localhost Configuration

To resolve domains locally, update your `/etc/hosts` or `C:\Windows\System32\drivers\etc\hosts` file:

```text
127.0.0.1 api.test.com app.test.com
```

---

## ⚙️ Setup Instructions

### 1️⃣ Install Node.js Dependencies

```bash
npm install
```

### 2️⃣ Configure Authorization Server

Edit the `config.js` file to set your OIDC/OAuth2 authorization server details.

---

## 🚀 Running the Application

### 3️⃣ Start Node Server

```bash
node ./index.js
```

### 4️⃣ Access Application

Visit in browser:

```
https://app.test.com
```

---

## 🌐 Example Interaction

1. Frontend loads and checks session via `GET /session`.
2. If session is invalid, backend returns an authorization challenge URL.
3. Browser is redirected to authorization server login.
4. After successful auth, user lands on `https://api.test.com/callback`.
5. Backend:
   - Exchanges code for access and refresh tokens.
   - Sets `session_id` cookie scoped to `.test.com`.
   - Redirects to `https://app.test.com`.
6. User clicks **[User Info Call]**:
   - Frontend calls `https://api.test.com/resource/oidc/userinfo`.
   - BFF verifies session, injects token, proxies to `https://graph.microsoft.com/oidc/userinfo`.
   - Response is sent back to frontend.

---

## 🔄 Future Improvements

- Implement secure randomization and hardening of the `session_id` cookie.
- Integrate Redis or similar shared cache for clustered BFF deployments.
- Use refresh token to extend user session.

---

## ✅ Summary

- Demonstrates secure OAuth 2.0 browser-based login using BFF pattern.
- Shares session via domain cookie across frontend and backend.
- Protects access tokens in backend; only session cookie is exposed to the browser.
- Frontend interacts with resource servers via authenticated proxy.

---
