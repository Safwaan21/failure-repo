# Odds Game

A real-time multiplayer game where two players enter numbers and see if they match.

## Game Rules

1. Players enter their name to join a room
2. When two players join the same room, they each enter a number
3. A 5-second timer counts down
4. After the timer ends, both numbers are revealed
5. If the numbers match, "ODDS MET" is displayed; otherwise, "ODDS LOST" is displayed

## Features

- Real-time updates using Pusher
- Automatic room matching
- Player leave detection
- Responsive design

## Tech Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- Pusher for real-time communication

## Deployment

This application is designed to be deployed on Vercel.

### Prerequisites

1. Create a [Pusher](https://pusher.com/) account and create a new Channels app
2. Get your Pusher credentials (App ID, Key, Secret, Cluster)

### Deployment Steps

1. Fork or clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env.local` file with your Pusher credentials:
   ```
   PUSHER_APP_ID=your_app_id
   PUSHER_SECRET=your_app_secret
   NEXT_PUBLIC_PUSHER_APP_KEY=your_app_key
   NEXT_PUBLIC_PUSHER_CLUSTER=your_app_cluster
   ```
4. Deploy to Vercel:
   - Connect your GitHub repository to Vercel
   - Add the environment variables from step 3 to your Vercel project
   - Deploy the application

### Local Development

1. Install dependencies:
   ```
   npm install
   ```
2. Create a `.env.local` file with your Pusher credentials (as shown above)
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Important Notes

- The current implementation uses in-memory storage for rooms, which is not suitable for production. In a real production environment, you would use a database like MongoDB, PostgreSQL, or a serverless database like Supabase or Firebase.
- For a production application, you would want to add authentication and better error handling.

## License

MIT
