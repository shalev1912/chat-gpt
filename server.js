const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*'
	}
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Gameplay constants (top-down runner)
const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

const COLS_PER_TRACK = 3; // three columns per player's track

const PLAYER_SIZE = 44;
const OBSTACLE_WIDTH = 44;
const OBSTACLE_HEIGHT = 44;

const PLAYER_Y = CANVAS_HEIGHT - 100; // players near the bottom (fixed)

const BASE_SPEED = 260; // px/s
const SPEED_GROWTH_PER_SEC = 18; // px/s^2
const MAX_SPEED = 650;

const INITIAL_SPAWN_INTERVAL_MIN = 900; // ms
const INITIAL_SPAWN_INTERVAL_MAX = 1300; // ms
const MIN_SPAWN_INTERVAL_MIN = 550; // ms
const MIN_SPAWN_INTERVAL_MAX = 900; // ms
const SPAWN_EASE_DURATION_MS = 60000; // reach min after 60s

// Rooms state
const rooms = new Map(); // roomId -> RoomState
let waitingSocketId = null;
let nextRoomId = 1;

function createEmptyRoom(id, mode, numLanes) {
	return {
		id,
		mode, // 'single' | 'multi'
		numLanes, // 1 or 2
		socketIds: [],
		players: new Map(), // socketId -> PlayerState
		gameStarted: false,
		intervalHandle: null,
		lastTickMs: 0,
		elapsedMs: 0,
		speedPxPerSec: BASE_SPEED,
		distancePx: 0,
		obstaclesByLane: Array.from({ length: numLanes }, () => []), // [{ y, colIndex }]
		spawnStateByLane: Array.from({ length: numLanes }, () => createSpawnState()),
		readyForRestart: new Set()
	};
}

function createSpawnState() {
	return { nextSpawnAtMs: 0 };
}

function createPlayer(socketId, laneIndex) {
	return {
		socketId,
		laneIndex, // 0 or 1 within room
		colIndex: 1, // 0 left, 1 middle, 2 right
		alive: true
	};
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function interpolateSpawns(elapsedMs) {
	const t = clamp(elapsedMs / SPAWN_EASE_DURATION_MS, 0, 1);
	const minInterval = Math.round(INITIAL_SPAWN_INTERVAL_MIN * (1 - t) + MIN_SPAWN_INTERVAL_MIN * t);
	const maxInterval = Math.round(INITIAL_SPAWN_INTERVAL_MAX * (1 - t) + MIN_SPAWN_INTERVAL_MAX * t);
	return { minInterval, maxInterval };
}

function randomBetween(min, max) {
	return Math.random() * (max - min) + min;
}

function spawnObstacle(room, laneIndex, nowMs) {
	const colIndex = Math.floor(Math.random() * COLS_PER_TRACK);
	const y = -OBSTACLE_HEIGHT; // spawn above the screen
	room.obstaclesByLane[laneIndex].push({ y, colIndex });
	const { minInterval, maxInterval } = interpolateSpawns(room.elapsedMs);
	room.spawnStateByLane[laneIndex].nextSpawnAtMs = nowMs + Math.round(randomBetween(minInterval, maxInterval));
}

function resetGameState(room) {
	room.gameStarted = false;
	room.lastTickMs = 0;
	room.elapsedMs = 0;
	room.speedPxPerSec = BASE_SPEED;
	room.distancePx = 0;
	room.obstaclesByLane = Array.from({ length: room.numLanes }, () => []);
	room.spawnStateByLane = Array.from({ length: room.numLanes }, () => createSpawnState());
	room.readyForRestart.clear();
	for (const player of room.players.values()) {
		player.colIndex = 1;
		player.alive = true;
	}
}

function startGameLoop(room) {
	if (room.intervalHandle) clearInterval(room.intervalHandle);
	room.gameStarted = true;
	room.lastTickMs = Date.now();
	room.intervalHandle = setInterval(() => tickRoom(room), MS_PER_TICK);
}

function stopGameLoop(room) {
	if (room.intervalHandle) {
		clearInterval(room.intervalHandle);
		room.intervalHandle = null;
	}
	room.gameStarted = false;
}

function tickRoom(room) {
	const now = Date.now();
	const dtMs = now - room.lastTickMs;
	if (dtMs <= 0) return;
	room.lastTickMs = now;
	room.elapsedMs += dtMs;

	// increase speed over time
	const elapsedSec = room.elapsedMs / 1000;
	room.speedPxPerSec = clamp(BASE_SPEED + SPEED_GROWTH_PER_SEC * elapsedSec, BASE_SPEED, MAX_SPEED);

	const dy = (room.speedPxPerSec * dtMs) / 1000;
	room.distancePx += dy;

	// spawn obstacles per lane
	for (let laneIndex = 0; laneIndex < room.numLanes; laneIndex += 1) {
		const spawnState = room.spawnStateByLane[laneIndex];
		if (spawnState.nextSpawnAtMs === 0) {
			const { minInterval, maxInterval } = interpolateSpawns(room.elapsedMs);
			spawnState.nextSpawnAtMs = now + Math.round(randomBetween(minInterval, maxInterval));
		}
		if (now >= spawnState.nextSpawnAtMs) {
			spawnObstacle(room, laneIndex, now);
		}
	}

	// move obstacles and remove out-of-bounds
	for (let laneIndex = 0; laneIndex < room.numLanes; laneIndex += 1) {
		const obstacles = room.obstaclesByLane[laneIndex];
		for (const obstacle of obstacles) {
			obstacle.y += dy;
		}
		while (obstacles.length > 0 && obstacles[0].y > CANVAS_HEIGHT + OBSTACLE_HEIGHT + 10) {
			obstacles.shift();
		}
	}

	// collision detection
	const players = Array.from(room.players.values());
	for (const player of players) {
		if (!player.alive) continue;
		const laneIndex = player.laneIndex;
		const playerRect = {
			x: colIndexToX(room, laneIndex, player.colIndex, PLAYER_SIZE),
			y: PLAYER_Y,
			w: PLAYER_SIZE,
			h: PLAYER_SIZE
		};
		const obstacles = room.obstaclesByLane[laneIndex];
		for (const obstacle of obstacles) {
			const obstacleRect = {
				x: colIndexToX(room, laneIndex, obstacle.colIndex, OBSTACLE_WIDTH),
				y: obstacle.y,
				w: OBSTACLE_WIDTH,
				h: OBSTACLE_HEIGHT
			};
			if (rectsOverlap(playerRect, obstacleRect)) {
				player.alive = false;
				break;
			}
		}
	}

	const alivePlayers = players.filter(p => p.alive);
	if (alivePlayers.length < players.length && room.gameStarted) {
		// end game when any player dies
		stopGameLoop(room);
		let winnerLane = null;
		if (room.mode === 'multi' && players.length === 2) {
			if (players[0].alive && !players[1].alive) winnerLane = players[0].laneIndex;
			else if (!players[0].alive && players[1].alive) winnerLane = players[1].laneIndex;
			else winnerLane = -1; // tie
		} else {
			winnerLane = alivePlayers.length === 1 ? alivePlayers[0].laneIndex : -1;
		}
		io.to(room.id).emit('gameOver', {
			distance: Math.round(room.distancePx),
			speed: Math.round(room.speedPxPerSec),
			winnerLane
		});
		return;
	}

	// broadcast state
	io.to(room.id).emit('state', buildSnapshot(room));
}

function colIndexToX(room, laneIndex, colIndex, widthPx) {
	const laneWidth = CANVAS_WIDTH / room.numLanes;
	const colWidth = laneWidth / COLS_PER_TRACK;
	const trackOffset = laneIndex * laneWidth;
	return Math.round(trackOffset + colIndex * colWidth + (colWidth - widthPx) / 2);
}

function rectsOverlap(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildSnapshot(room) {
	const players = Array.from(room.players.values()).map(p => ({
		laneIndex: p.laneIndex,
		colIndex: p.colIndex,
		alive: p.alive
	}));
	return {
		canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
		playerY: PLAYER_Y,
		playerSize: PLAYER_SIZE,
		obstacleSize: { w: OBSTACLE_WIDTH, h: OBSTACLE_HEIGHT },
		colsPerTrack: COLS_PER_TRACK,
		numLanes: room.numLanes,
		obstaclesByLane: room.obstaclesByLane,
		players,
		speed: Math.round(room.speedPxPerSec),
		distance: Math.round(room.distancePx),
		elapsedMs: room.elapsedMs
	};
}

io.on('connection', (socket) => {
	// wait for client to choose mode
	socket.emit('readyToChooseMode');

	socket.on('startSingle', () => {
		if (findRoomBySocket(socket.id)) return; // already in a room
		if (waitingSocketId === socket.id) waitingSocketId = null;
		const roomId = String(nextRoomId++);
		const room = createEmptyRoom(roomId, 'single', 1);
		rooms.set(roomId, room);

		room.socketIds.push(socket.id);
		room.players.set(socket.id, createPlayer(socket.id, 0));

		socket.join(roomId);
		io.to(socket.id).emit('matchFound', { roomId, laneIndex: 0, mode: 'single' });
		resetGameState(room);
		startGameLoop(room);
		io.to(roomId).emit('gameStart', { roomId, mode: 'single' });
	});

	socket.on('startMultiplayer', () => {
		if (findRoomBySocket(socket.id)) return; // already in a room
		if (waitingSocketId && waitingSocketId !== socket.id) {
			const roomId = String(nextRoomId++);
			const room = createEmptyRoom(roomId, 'multi', 2);
			rooms.set(roomId, room);

			room.socketIds.push(waitingSocketId);
			room.socketIds.push(socket.id);

			room.players.set(waitingSocketId, createPlayer(waitingSocketId, 0));
			room.players.set(socket.id, createPlayer(socket.id, 1));

			io.sockets.sockets.get(waitingSocketId)?.join(roomId);
			socket.join(roomId);

			for (const sid of room.socketIds) {
				io.to(sid).emit('matchFound', { roomId, laneIndex: room.players.get(sid).laneIndex, mode: 'multi' });
			}
			waitingSocketId = null;

			resetGameState(room);
			startGameLoop(room);
			io.to(roomId).emit('gameStart', { roomId, mode: 'multi' });
		} else {
			waitingSocketId = socket.id;
			socket.emit('waiting', { message: 'ממתין לשחקן נוסף...' });
		}
	});

	socket.on('input', (payload) => {
		const room = findRoomBySocket(socket.id);
		if (!room || !room.gameStarted) return;
		const player = room.players.get(socket.id);
		if (!player || !player.alive) return;
		if (payload?.type === 'move') {
			if (payload.direction === 'left') {
				player.colIndex = clamp(player.colIndex - 1, 0, COLS_PER_TRACK - 1);
			} else if (payload.direction === 'right') {
				player.colIndex = clamp(player.colIndex + 1, 0, COLS_PER_TRACK - 1);
			}
		}
	});

	socket.on('requestRestart', () => {
		const room = findRoomBySocket(socket.id);
		if (!room) return;
		room.readyForRestart.add(socket.id);
		io.to(room.id).emit('playerReady', { socketId: socket.id, readyCount: room.readyForRestart.size });
		if (room.readyForRestart.size === room.socketIds.length) {
			resetGameState(room);
			startGameLoop(room);
			io.to(room.id).emit('gameStart', { roomId: room.id, mode: room.mode });
		}
	});

	socket.on('disconnect', () => {
		if (waitingSocketId === socket.id) {
			waitingSocketId = null;
			return;
		}
		const room = findRoomBySocket(socket.id);
		if (!room) return;
		room.socketIds = room.socketIds.filter((sid) => sid !== socket.id);
		room.players.delete(socket.id);

		if (room.gameStarted && room.socketIds.length > 0) {
			stopGameLoop(room);
			io.to(room.id).emit('opponentDisconnected');
		}
		if (room.socketIds.length === 0) {
			stopGameLoop(room);
			rooms.delete(room.id);
		}
	});
});

function findRoomBySocket(socketId) {
	for (const room of rooms.values()) {
		if (room.socketIds.includes(socketId)) return room;
	}
	return null;
}

server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});