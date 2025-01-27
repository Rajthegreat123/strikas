# Strikas - Multiplayer Soccer Game

A web-based multiplayer soccer game inspired by Soccer Stars, built with React, Node.js, and Socket.IO.

## Features

- Real-time multiplayer gameplay
- User authentication
- Public and private game lobbies
- Stats tracking
- Physics-based gameplay

## Tech Stack

- Frontend: React.js
- Backend: Node.js with Express
- Database: Firebase
- Real-time Communication: Socket.IO
- Authentication: JWT
- Game Physics: Matter.js

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Firebase account

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd client
   npm install
   ```
4. Create a .env file in the root directory with the following variables:
   ```
   PORT=3001
   JWT_SECRET=your_jwt_secret
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_PRIVATE_KEY=your_firebase_private_key
   FIREBASE_CLIENT_EMAIL=your_firebase_client_email
   ```

### Running the Application

1. Start the backend server:
   ```bash
   npm run dev
   ```
2. In a separate terminal, start the frontend:
   ```bash
   npm run client
   ```
3. Access the application at `http://localhost:3000`

## Development

- Backend runs on port 3001
- Frontend runs on port 3000
- WebSocket connection is automatically established

## License

MIT
