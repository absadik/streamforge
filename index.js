require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const OpenAI = require("openai");
const { ApiClient } = require("@twurple/api");
const { RefreshingAuthProvider } = require("@twurple/auth");
const { EventSubWsListener } = require("@twurple/eventsub-ws");
const fs = require("fs/promises");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PORT = process.env.PORT || 3000;
const WINDOW = 60_000;
const THRESHOLD = 5;
const QUIET_DELAY = 30_000;

const {
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_BROADCASTER_ID,
  TWITCH_USER_ID,
  TWITCH_USER_ACCESS_TOKEN,
  TWITCH_USER_REFRESH_TOKEN
} = process.env;

const required = [
  "OPENAI_API_KEY",
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "TWITCH_BROADCASTER_ID",
  "TWITCH_USER_ID",
  "TWITCH_USER_ACCESS_TOKEN",
  "TWITCH_USER_REFRESH_TOKEN"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const messages = [];
let quietSince = null;
let questionPending = false;
let questionSent = false;
let lastQuestion = "";
let twitchStatus = "Connecting to Twitch";
let listener;

function getMessageCount() {
  const cutoff = Date.now() - WINDOW;
  while (messages.length && messages[0] < cutoff) {
    messages.shift();
  }
  return messages.length;
}

function broadcastStatus() {
  const count = getMessageCount();
  io.emit("live-stats", {
    messageCount: count,
    threshold: THRESHOLD,
    twitchStatus,
    question: lastQuestion
  });
  return count;
}

async function generateQuestion() {
  if (questionPending) return;
  questionPending = true;

  try {
    const recentCount = getMessageCount();
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions:
        "You are StreamForge, a Twitch streamer engagement assistant. " +
        "Generate exactly ONE specific, natural question the streamer can " +
        "ask viewers to restart conversation. Use the recent chat context " +
        "if useful. Do not invent stream details. Output only the question.",
      input:
        "The chat has been quiet for at least 30 seconds. " +
        `There were ${recentCount} messages in the last 60 seconds. ` +
        "Recent viewer messages: " +
        JSON.stringify(messages.slice(-10))
    });

    const question = response.output_text.trim();
    if (!question) {
      throw new Error("OpenAI returned an empty question");
    }

    lastQuestion = question;
    questionSent = true;
    io.emit("ai-question", question);
    broadcastStatus();
    console.log("Engagement question:", question);
  } catch (error) {
    console.error("Question generation failed:", error.message);
    io.emit("ai-error", "Could not generate a question. Please try again.");
  } finally {
    questionPending = false;
  }
}

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StreamForge</title>
<style>
body { background:#0b0f19;color:#fff;font-family:Arial,sans-serif; padding:20px;margin:0 }
main { max-width:700px;margin:40px auto;background:#151b2b; padding:25px;border-radius:15px }
h1 {color:#7c9cff}
p {line-height:1.6}
.card { background:#0b0f19;border:1px solid #28344d; padding:18px;border-radius:10px;margin-top:20px }
.label {color:#7c9cff}
button { width:100%;padding:14px;background:#6c63ff;color:white; border:0;border-radius:8px;font-size:16px;cursor:pointer }
.small {color:#a0aec0;font-size:13px}
</style>
</head>
<body>
<main>
  <h1>StreamForge</h1>
  <p class="small">AI Live Growth Co-Pilot</p>
  <p id="status">Connecting to Twitch...</p>

  <section class="card">
    <p class="label">Messages in the last 60 seconds</p>
    <h2 id="count">0</h2>
    <p class="small">Quiet-chat threshold: fewer than 5 messages/minute</p>
  </section>

  <section class="card">
    <p class="label">AI Engagement Suggestion</p>
    <p id="question">Waiting for chat activity...</p>
  </section>

  <p id="error" class="small"></p>
  <p class="small">StreamForge Hackathon Prototype</p>
</main>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
socket.on("live-stats", data => {
  document.getElementById("count").textContent = data.messageCount;
  document.getElementById("status").textContent = "Twitch: " + data.twitchStatus;
});
socket.on("ai-question", question => {
  document.getElementById("question").textContent = question;
  document.getElementById("error").textContent = "";
});
socket.on("ai-error", message => {
  document.getElementById("error").textContent = message;
});
socket.on("connect", () => {
  document.getElementById("error").textContent = "";
});
socket.on("disconnect", () => {
  document.getElementById("status").textContent = "Dashboard disconnected";
});
</script>
</body>
</html>`);
});

async function startTwitch() {
  const tokenFile = "./twitch-token.json";
  let token;
  try {
    token = JSON.parse(await fs.readFile(tokenFile, "utf8"));
  } catch {
    token = {
      accessToken: TWITCH_USER_ACCESS_TOKEN,
      refreshToken: TWITCH_USER_REFRESH_TOKEN,
      expiresIn: 0,
      obtainmentTimestamp: 0,
      scope: ["user:read:chat"]
    };
  }

  const authProvider = new RefreshingAuthProvider({
    clientId: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_CLIENT_SECRET
  });

  authProvider.onRefresh(async (userId, newToken) => {
    if (userId === TWITCH_USER_ID) {
      await fs.writeFile(tokenFile, JSON.stringify(newToken, null, 2));
    }
  });

  authProvider.onRefreshFailure((userId, error) => {
    console.error("Twitch token refresh failed:", error.message);
  });

  authProvider.addUser(TWITCH_USER_ID, token);
  const apiClient = new ApiClient({ authProvider });
  listener = new EventSubWsListener({ apiClient });

  listener.onChannelChatMessage(TWITCH_BROADCASTER_ID, TWITCH_USER_ID, event => {
      messages.push(Date.now());
      getMessageCount();
      if (getMessageCount() >= THRESHOLD) {
        quietSince = null;
        questionSent = false;
      }
      broadcastStatus();
    }
  );

  await listener.start();
  twitchStatus = "Connected";
  broadcastStatus();
  console.log("StreamForge is listening for Twitch chat messages.");
}

setInterval(() => {
  const count = getMessageCount();
  if (count >= THRESHOLD) {
    quietSince = null;
    questionSent = false;
  } else {
    if (quietSince === null) {
      quietSince = Date.now();
    }
    const quietDuration = Date.now() - quietSince;
    if (quietDuration >= QUIET_DELAY && !questionSent) {
      generateQuestion();
    }
  }
  broadcastStatus();
}, 1000);

server.listen(PORT, "0.0.0.0", () => {
  console.log("StreamForge dashboard running on port " + PORT);
  startTwitch().catch(error => {
    twitchStatus = "Connection failed";
    console.error("Twitch startup failed:", error.message);
    broadcastStatus();
  });
});
