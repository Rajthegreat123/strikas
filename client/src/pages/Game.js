import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styled from 'styled-components';
import Matter from 'matter-js';
import io from 'socket.io-client';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_RADIUS = 30;
const BALL_RADIUS = 15;
const GOAL_WIDTH = 20;
const GOAL_HEIGHT = 120;
const PLAYER_SPEED = 5;

const Game = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const socketRef = useRef(null);
  const gameLoopRef = useRef(null);
  const [score, setScore] = useState({ host: 0, guest: 0 });
  const [gameState, setGameState] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState(null);

  // Socket connection effect
  useEffect(() => {
    let socket;
    
    const connectSocket = () => {
      console.log('Connecting to socket server...');
      socket = io('http://localhost:3001', {
        auth: { token: currentUser.token }
      });

      socket.on('connect', () => {
        console.log('Connected to game server');
        socket.emit('join-game', { gameId });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError('Failed to connect to game server');
      });

      socket.on('game-state', (state) => {
        console.log('Received game state:', state);
        setGameState(state);
        const isHostPlayer = state.players.host.id === currentUser.id;
        setIsHost(isHostPlayer);
        console.log('Player role:', isHostPlayer ? 'host' : 'guest');
      });

      socket.on('player-moved', ({ playerId, position, velocity }) => {
        if (!engineRef.current || playerId === currentUser.id) return;
        
        console.log('Received player movement:', { playerId, position });
        const world = engineRef.current.world;
        const players = Matter.Composite.allBodies(world).filter(body => 
          body.label.startsWith('player-')
        );
        
        const playerToUpdate = players.find(p => {
          const isHostPlayer = p.label === 'player-host';
          return (isHostPlayer && playerId === gameState?.players.host.id) ||
                 (!isHostPlayer && playerId === gameState?.players.guest.id);
        });

        if (playerToUpdate) {
          Matter.Body.setPosition(playerToUpdate, position);
          Matter.Body.setVelocity(playerToUpdate, velocity);
        }
      });

      socket.on('ball-update', ({ position, velocity }) => {
        if (!engineRef.current || isHost) return;
        
        const world = engineRef.current.world;
        const ball = Matter.Composite.allBodies(world).find(body => body.label === 'ball');
        if (ball) {
          Matter.Body.setPosition(ball, position);
          Matter.Body.setVelocity(ball, velocity);
        }
      });

      socket.on('score-update', (newScore) => {
        console.log('Score updated:', newScore);
        setScore(newScore);
      });

      socket.on('game-over', ({ winner, score }) => {
        console.log('Game over:', { winner, score });
        setScore(score);
        
        // Show game over message and redirect after delay
        const isWinner = (winner === 'host' && isHost) || (winner === 'guest' && !isHost);
        const message = isWinner ? 'You Won!' : 'You Lost!';
        alert(`Game Over! ${message} Final Score: ${score.host}-${score.guest}`);
        
        // Redirect to main menu after a short delay
        setTimeout(() => {
          navigate('/');
          window.location.reload();
        }, 2000);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from game server');
      });

      socketRef.current = socket;
    };

    if (currentUser && gameId) {
      connectSocket();
    }

    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
    };
  }, [currentUser, gameId]);

  // Game setup effect
  useEffect(() => {
    if (!canvasRef.current || !gameState) {
      console.log('Waiting for canvas and game state...');
      return;
    }

    console.log('Setting up game physics...');
    
    // Matter.js setup
    const Engine = Matter.Engine;
    const Render = Matter.Render;
    const World = Matter.World;
    const Bodies = Matter.Bodies;
    const Body = Matter.Body;
    const Events = Matter.Events;

    // Create engine
    const engine = Engine.create({
      gravity: { x: 0, y: 0 }
    });
    engineRef.current = engine;

    // Create renderer
    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        wireframes: false,
        background: '#2a2a2a'
      }
    });

    // Create walls
    const walls = [
      Bodies.rectangle(CANVAS_WIDTH/2, 0, CANVAS_WIDTH, 20, { 
        isStatic: true,
        label: 'wall-top'
      }),
      Bodies.rectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT, CANVAS_WIDTH, 20, { 
        isStatic: true,
        label: 'wall-bottom'
      }),
      Bodies.rectangle(0, CANVAS_HEIGHT/2, 20, CANVAS_HEIGHT, { 
        isStatic: true,
        label: 'wall-left'
      }),
      Bodies.rectangle(CANVAS_WIDTH, CANVAS_HEIGHT/2, 20, CANVAS_HEIGHT, { 
        isStatic: true,
        label: 'wall-right'
      })
    ];

    // Create goals with sensors
    const leftGoal = Bodies.rectangle(
      0, CANVAS_HEIGHT/2, GOAL_WIDTH, GOAL_HEIGHT, 
      { 
        isStatic: true,
        isSensor: true,
        label: 'goal-left',
        render: { fillStyle: '#4444ff' }
      }
    );

    const rightGoal = Bodies.rectangle(
      CANVAS_WIDTH, CANVAS_HEIGHT/2, GOAL_WIDTH, GOAL_HEIGHT,
      { 
        isStatic: true,
        isSensor: true,
        label: 'goal-right',
        render: { fillStyle: '#ff4444' }
      }
    );

    // Create ball
    const ball = Bodies.circle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, BALL_RADIUS, {
      restitution: 0.8,
      friction: 0.005,
      label: 'ball',
      render: { fillStyle: '#ffffff' }
    });

    // Create players
    const hostPlayer = Bodies.circle(200, CANVAS_HEIGHT/2, PLAYER_RADIUS, {
      label: 'player-host',
      friction: 0.05,
      restitution: 0.5,
      render: { fillStyle: '#4444ff' }
    });

    const guestPlayer = Bodies.circle(CANVAS_WIDTH - 200, CANVAS_HEIGHT/2, PLAYER_RADIUS, {
      label: 'player-guest',
      friction: 0.05,
      restitution: 0.5,
      render: { fillStyle: '#ff4444' }
    });

    // Add collision detection for goals
    Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const ball = bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null;
        const goal = bodyA.label.startsWith('goal-') ? bodyA : bodyB.label.startsWith('goal-') ? bodyB : null;

        if (ball && goal) {
          console.log('Goal detected!', goal.label);
          const scorer = goal.label === 'goal-left' ? 'guest' : 'host';
          if (socketRef.current) {
            socketRef.current.emit('goal-scored', { gameId, scorer });
          }
          
          // Reset ball position
          Body.setPosition(ball, { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 });
          Body.setVelocity(ball, { x: 0, y: 0 });
        }
      });
    });

    // Add all bodies to world
    World.add(engine.world, [...walls, leftGoal, rightGoal, ball, hostPlayer, guestPlayer]);

    // Start the engine
    Engine.run(engine);
    Render.run(render);

    // Handle keyboard controls
    const keys = {};

    const handleKeyDown = (e) => {
      keys[e.key] = true;
    };

    const handleKeyUp = (e) => {
      keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 16; // ~60 updates per second

    const gameLoop = (timestamp) => {
      const player = isHost ? hostPlayer : guestPlayer;
      
      if (player) {
        // Apply forces based on key states
        let xForce = 0;
        let yForce = 0;
        
        if (keys['ArrowUp']) yForce = -PLAYER_SPEED;
        if (keys['ArrowDown']) yForce = PLAYER_SPEED;
        if (keys['ArrowLeft']) xForce = -PLAYER_SPEED;
        if (keys['ArrowRight']) xForce = PLAYER_SPEED;

        // Update player velocity
        if (xForce !== 0 || yForce !== 0) {
          Body.setVelocity(player, { x: xForce, y: yForce });
        } else {
          // Add some friction when no keys are pressed
          Body.setVelocity(player, { 
            x: player.velocity.x * 0.95, 
            y: player.velocity.y * 0.95 
          });
        }

        // Keep players within bounds
        const pos = player.position;
        const bounds = {
          min: { x: PLAYER_RADIUS, y: PLAYER_RADIUS },
          max: { x: CANVAS_WIDTH - PLAYER_RADIUS, y: CANVAS_HEIGHT - PLAYER_RADIUS }
        };

        if (pos.x < bounds.min.x) Body.setPosition(player, { x: bounds.min.x, y: pos.y });
        if (pos.x > bounds.max.x) Body.setPosition(player, { x: bounds.max.x, y: pos.y });
        if (pos.y < bounds.min.y) Body.setPosition(player, { y: bounds.min.y, x: pos.x });
        if (pos.y > bounds.max.y) Body.setPosition(player, { y: bounds.max.y, x: pos.x });

        // Send position updates at fixed interval
        if (timestamp - lastUpdate > UPDATE_INTERVAL) {
          if (socketRef.current) {
            // Emit player position
            socketRef.current.emit('player-update', {
              gameId,
              position: player.position,
              velocity: player.velocity
            });

            // Host syncs ball position
            if (isHost && ball) {
              socketRef.current.emit('ball-update', {
                gameId,
                position: ball.position,
                velocity: ball.velocity
              });
            }
          }
          lastUpdate = timestamp;
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    // Cleanup
    return () => {
      console.log('Cleaning up game physics...');
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      Events.off(engine);
      Render.stop(render);
      Engine.clear(engine);
      World.clear(engine.world);
    };
  }, [gameState, isHost, gameId]);

  if (error) {
    return (
      <ErrorContainer>
        <ErrorMessage>{error}</ErrorMessage>
        <Button onClick={() => navigate('/lobbies')}>Back to Lobbies</Button>
      </ErrorContainer>
    );
  }

  return (
    <Container>
      <ScoreBoard>
        <Score>{score.host}</Score>
        <Divider>-</Divider>
        <Score>{score.guest}</Score>
      </ScoreBoard>
      <Canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <Controls>
        Use arrow keys to move your player
      </Controls>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: #1a1a1a;
  color: white;
  overflow: hidden;
`;

const Canvas = styled.canvas`
  background: #2a2a2a;
  margin-top: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
`;

const ScoreBoard = styled.div`
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 1rem 2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 2rem;
  font-weight: bold;

  &:after {
    content: 'First to 5 wins!';
    position: absolute;
    bottom: -1.5rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.8rem;
    opacity: 0.7;
    white-space: nowrap;
  }
`;

const Score = styled.span`
  min-width: 2ch;
  text-align: center;
`;

const Divider = styled.span`
  opacity: 0.7;
`;

const Controls = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  font-size: 1.2rem;
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a1a;
  color: white;
  gap: 1rem;
`;

const ErrorMessage = styled.div`
  color: #ff4444;
  font-size: 1.2rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: #4444ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;

  &:hover {
    background: #3333cc;
  }
`;

export default Game;
