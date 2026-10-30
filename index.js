const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve the dashboard directly from this file.
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StreamForge</title>
<style>
body { background:#0b0f19;color:#fff;font-family:Arial,sans-serif; padding:20px;margin:0 }
main { max-width:700px;margin:40px auto;background:#151b2b; padding:25px;border-radius:15px; text-align: center; }
h1 {color:#7c9cff}
p {line-height:1.6}
.card { background:#0b0f19;border:1px solid #28344d; padding:18px;border-radius:10px;margin-top:20px; text-align: left; }
.label {color:#7c9cff}
button { width:100%;padding:14px;background:#6c63ff;color:white; border:0;border-radius:8px;font-size:16px;cursor:pointer; margin-top: 20px;}
button:hover { background: #5548e8; }
button:disabled { opacity:0.6; cursor: wait; }
.small {color:#a0aec0;font-size:13px}
</style>
</head>
<body>
<main>
  <h1>StreamForge</h1>
  <p class="small">AI Live Growth Co-Pilot</p>
  
  <button id="simulateButton">Simulate Dead Chat (Demo)</button>

  <section class="card">
    <p class="label">AI Engagement Suggestion</p>
    <p id="question">Waiting for chat activity...</p>
  </section>

  <p class="small">StreamForge Hackathon Prototype</p>
</main>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const button = document.getElementById("simulateButton");
const question = document.getElementById("question");

button.addEventListener("click", () => {
  question.textContent = "Detecting low chat activity...";
  button.disabled = true;
  socket.emit("simulate-dead-chat");
});

socket.on("ai-question", (msg) => {
  question.textContent = msg;
  button.disabled = false;
});
</script>
</body>
</html>`);
});

// Socket.io events for the demo button
io.on("connection", (socket) => {
  socket.on("simulate-dead-chat", () => {
    setTimeout(() => {
      socket.emit("ai-question", "Chat is quiet. Ask them: What is your favorite game so far?");
    }, 2000);
  });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log("StreamForge Dashboard running on port " + PORT);
});
