# StreamForge: The AI Live Growth Co-Pilot

## Inspiration
Every Twitch streamer knows the feeling: chat goes silent, energy drops, and viewers start to leave. Streamers can't watch chat, play the game, and be a data analyst at the same time. We built StreamForge to solve Twitch's biggest growth problem: keeping the conversation alive.

## What it does
StreamForge is an AI co-pilot that listens to Twitch EventSub in real-time. It visualizes chat energy and acts like a producer in your ear. When it detects a sustained lull in chat (fewer than 5 messages per minute for over 30 seconds), it uses OpenAI Codex (gpt-4o-mini) to generate a single, hyper-specific engagement prompt based on recent chat context. It is delivered privately to a dashboard.

## How we built it
- **Backend:** Node.js, Express, Socket.io
- **Twitch Integration:** `@twurple/eventsub-ws` for real-time WebSocket chat listening.
- **AI Brain:** OpenAI Node.js SDK (`gpt-4o-mini`).
- **Frontend:** A custom dark-mode dashboard served directly by Express.

## How to run it
1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in your Twitch API credentials and OpenAI API key.
4. Run `npm start`.
5. Open `http://localhost:3000` to view the dashboard.

## Built With
- OpenAI Codex
- Twitch API (EventSub)
- Node.js
- Socket.io
- Express
