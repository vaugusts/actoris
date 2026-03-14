import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { buildSchema, graphql } from "graphql";
import { WebSocketServer } from "ws";

const users = [
  { username: "standard_user", password: "secret_sauce", role: "tester", displayName: "Standard User" },
  { username: "admin_user", password: "admin_secret", role: "admin", displayName: "Admin User" }
];

const products = [
  { id: "SKU-100", name: "Automation T-Shirt", price: 25 },
  { id: "SKU-200", name: "POM Notebook", price: 14 }
];

export interface RunningMockServer {
  port: number;
  url: string;
  stop(): Promise<void>;
}

export async function startMockServer(port = Number(process.env.MOCK_PORT ?? 3100)): Promise<RunningMockServer> {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.text({ type: ["text/xml", "application/soap+xml"] }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", protocols: ["rest", "graphql", "soap", "websocket"] });
  });

  app.get("/api/test-data/users", (_request, response) => {
    response.json(users);
  });

  app.post("/api/auth/login", (request, response) => {
    const { username, password } = request.body as { username?: string; password?: string };
    const user = users.find((candidate) => candidate.username === username && candidate.password === password);

    if (!user) {
      response.status(401).json({ message: "Invalid credentials" });
      return;
    }

    response.json({
      token: `mock-token-${user.username}`,
      profile: {
        username: user.username,
        role: user.role,
        displayName: user.displayName
      }
    });
  });

  app.get("/api/catalog/products", (_request, response) => {
    response.json(products);
  });

  app.post("/api/orders", (request, response) => {
    response.status(201).json({
      orderId: randomUUID(),
      items: request.body?.items ?? [],
      createdAt: new Date().toISOString()
    });
  });

  app.post("/soap", (request, response) => {
    const body = request.body as string;
    const usernameMatch = body.match(/<Username>(.*?)<\/Username>/);
    const username = usernameMatch?.[1] ?? "unknown";
    const user = users.find((candidate) => candidate.username === username);

    response.type("application/soap+xml").send(`<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetUserResponse>
      <Username>${username}</Username>
      <DisplayName>${user?.displayName ?? "Unknown"}</DisplayName>
      <Role>${user?.role ?? "Unknown"}</Role>
    </GetUserResponse>
  </soap:Body>
</soap:Envelope>`);
  });

  const schema = buildSchema(`
    type User {
      username: String!
      role: String!
      displayName: String!
    }

    type Product {
      id: String!
      name: String!
      price: Int!
    }

    type Query {
      user(username: String!): User
      products: [Product!]!
    }
  `);

  app.post("/graphql", async (request, response) => {
    const result = await graphql({
      schema,
      source: String(request.body.query ?? ""),
      rootValue: {
        user: ({ username }: { username: string }) => users.find((candidate) => candidate.username === username),
        products: () => products
      },
      variableValues: (request.body.variables ?? {}) as Record<string, unknown>
    });

    response.json(result);
  });

  app.get("/app/login", (_request, response) => {
    response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mock Login</title>
    <style>
      body { font-family: "IBM Plex Sans", sans-serif; background: linear-gradient(140deg, #f6f3ea, #dceef7); min-height: 100vh; display: grid; place-items: center; margin: 0; }
      .card { width: min(420px, 92vw); background: rgba(255,255,255,0.92); border-radius: 24px; padding: 2rem; box-shadow: 0 20px 60px rgba(18, 48, 65, 0.18); }
      h1 { margin-top: 0; font-size: 2rem; }
      label { display: block; margin-top: 1rem; font-weight: 700; }
      input { width: 100%; padding: 0.8rem 1rem; border-radius: 14px; border: 1px solid #8ea8b3; margin-top: 0.3rem; }
      button { margin-top: 1.2rem; width: 100%; border: 0; border-radius: 999px; padding: 0.9rem 1.2rem; background: #16425b; color: white; font-weight: 700; cursor: pointer; }
      [data-testid="welcome"] { margin-top: 1rem; color: #16425b; font-weight: 700; }
      [data-testid="error"] { margin-top: 1rem; color: #ab1f1f; font-weight: 700; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Automation Portal</h1>
      <label for="username">Username</label>
      <input id="username" data-testid="username" />
      <label for="password">Password</label>
      <input id="password" type="password" data-testid="password" />
      <button data-testid="login-button" type="button">Sign In</button>
      <p data-testid="welcome"></p>
      <p data-testid="error"></p>
    </main>
    <script>
      const username = document.querySelector('[data-testid="username"]');
      const password = document.querySelector('[data-testid="password"]');
      const button = document.querySelector('[data-testid="login-button"]');
      const welcome = document.querySelector('[data-testid="welcome"]');
      const error = document.querySelector('[data-testid="error"]');

      button.addEventListener('click', async () => {
        welcome.textContent = '';
        error.textContent = '';

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: username.value, password: password.value })
        });

        const payload = await response.json();
        if (!response.ok) {
          error.textContent = payload.message;
          return;
        }

        welcome.textContent = 'Welcome, ' + payload.profile.username;
      });
    </script>
  </body>
</html>`);
  });

  const server = http.createServer(app);
  const websocketServer = new WebSocketServer({ server, path: "/ws/events" });

  websocketServer.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "connected", message: "mock websocket ready" }));
    socket.on("message", (data) => {
      socket.send(JSON.stringify({ type: "echo", payload: data.toString() }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    async stop(): Promise<void> {
      websocketServer.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

if (require.main === module) {
  startMockServer().then((server) => {
    process.stdout.write(`Mock services listening on ${server.url}\n`);
  });
}
