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

// YouTube API key: must be provided via environment variable (no fallback)
require('dotenv').config();
const YT_API_KEY = process.env.YT_API_KEY;
if (!YT_API_KEY) {
	console.error('Missing YT_API_KEY environment variable. Please set it in your environment or .env file.');
	process.exit(1);
}

app.use(express.static(path.join(__dirname, 'public')));

// Serve the games folder so client can open pages like /games/guitar-master.html
app.use('/games', express.static(path.join(__dirname, 'games')));

// --- YouTube proxy endpoints ---
// GET /api/youtube/video?id=VIDEO_ID
// returns { ok:true, item: <videos.list item> } or { ok:false }
app.get('/api/youtube/video', async (req, res) => {
	const id = req.query.id;
	if(!id) return res.status(400).json({ ok:false, error: 'missing id' });
	try{
		const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(id)}&key=${YT_API_KEY}`;
		const r = await fetch(url);
		if(!r.ok) return res.status(r.status).json({ ok:false });
		const j = await r.json();
		if(!j.items || j.items.length===0) return res.json({ ok:false, items: [] });
		return res.json({ ok:true, items: j.items });
	}catch(err){
		console.error('youtube.video proxy error', err);
		return res.status(500).json({ ok:false, error: String(err) });
	}
});

// GET /api/youtube/captions?videoId=...&lang=he
// Attempts to fetch timedtext and returns parsed cues: [{start,dur,text}, ...]
app.get('/api/youtube/captions', async (req,res)=>{
	const vid = req.query.videoId;
	const lang = req.query.lang || 'he';
	if(!vid) return res.status(400).json({ ok:false, error:'missing videoId' });
	try{
		// Try the public timedtext endpoint
		const url = `https://video.google.com/timedtext?lang=${encodeURIComponent(lang)}&v=${encodeURIComponent(vid)}`;
		const r = await fetch(url);
		if(!r.ok) return res.status(502).json({ ok:false });
		const txt = await r.text();
		if(!txt || txt.trim()==='') return res.json({ ok:true, cues: [] });

		// crude XML parse for <text start="..." dur="...">content</text>
		const cues = [];
		const re = /<text([^>]*)>([\s\S]*?)<\/text>/g;
		let m;
		while((m = re.exec(txt)) !== null){
			const attrs = m[1];
			const content = m[2].replace(/\n/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"');
			const startMatch = /start="([^"]+)"/.exec(attrs);
			const durMatch = /dur="([^"]+)"/.exec(attrs);
			const start = startMatch ? parseFloat(startMatch[1]) : 0;
			const dur = durMatch ? parseFloat(durMatch[1]) : 0;
			cues.push({ start, dur, text: content });
		}
		return res.json({ ok:true, cues });
	}catch(err){
		console.error('captions proxy error', err);
		return res.status(500).json({ ok:false, error:String(err) });
	}
});

/**
 * Simple 2-player matchmaking with per-room authoritative game loop.
 */
const TICK_RATE = 60; // Hz
const MS_PER_TICK = 1000 / TICK_RATE;
const LANES_PER_PLAYER = 1; // conceptual; we have one lane per player
const ROWS_PER_LANE = 3; // each lane has 3 rows

const TRACK_PIXEL_LENGTH = 1000; // not visible, used for distance metrics
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

const PLAYER_X = 120; // x-position where player is fixed
const PLAYER_SIZE = 40; // collision size

const OBSTACLE_WIDTH = 40;
const OBSTACLE_HEIGHT = 40;

const BASE_SPEED = 260; // px/s initial
const SPEED_GROWTH_PER_SEC = 18; // px/s^2, linear growth
const MAX_SPEED = 650; // clamp

const INITIAL_SPAWN_INTERVAL_MIN = 900; // ms
const INITIAL_SPAWN_INTERVAL_MAX = 1300; // ms
const MIN_SPAWN_INTERVAL_MIN = 550; // ms
const MIN_SPAWN_INTERVAL_MAX = 900; // ms
const SPAWN_EASE_DURATION_MS = 60000; // after 60s reach min interval

/**
 * Rooms state
 */
const rooms = new Map(); // roomId -> RoomState
let waitingSocketId = null;
let nextRoomId = 1;

function createEmptyRoom(id) {
	return {
		id,
		socketIds: [], // exactly 2 when playing
		players: new Map(), // socketId -> PlayerState
		gameStarted: false,
		intervalHandle: null,
		lastTickMs: 0,
		elapsedMs: 0,
		speedPxPerSec: BASE_SPEED,
		distancePx: 0,
		obstaclesByLane: [[], []], // one array per player's lane
		spawnStateByLane: [createSpawnState(), createSpawnState()],
		readyForRestart: new Set()
	};
}

function createSpawnState() {
	return {
		nextSpawnAtMs: 0
	};
}

function createPlayer(socketId, laneIndex) {
	return {
		socketId,
		laneIndex, // 0 or 1
		rowIndex: 1, // 0 top, 1 middle, 2 bottom
		alive: true
	};
}

function laneRowToY(rowIndex) {
	const trackTop = 60;
	const trackHeight = CANVAS_HEIGHT - 120;
	const rowHeight = trackHeight / ROWS_PER_LANE;
	return Math.round(trackTop + rowHeight * rowIndex + (rowHeight - PLAYER_SIZE) / 2);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function interpolateSpawns(elapsedMs) {
	// ease from initial to min intervals over SPAWN_EASE_DURATION_MS
	const t = clamp(elapsedMs / SPAWN_EASE_DURATION_MS, 0, 1);
	const minInterval = Math.round(INITIAL_SPAWN_INTERVAL_MIN * (1 - t) + MIN_SPAWN_INTERVAL_MIN * t);
	const maxInterval = Math.round(INITIAL_SPAWN_INTERVAL_MAX * (1 - t) + MIN_SPAWN_INTERVAL_MAX * t);
	return { minInterval, maxInterval };
}

function randomBetween(min, max) {
	return Math.random() * (max - min) + min;
}

function spawnObstacle(room, laneIndex, nowMs) {
	const rowIndex = Math.floor(Math.random() * ROWS_PER_LANE);
	const x = CANVAS_WIDTH + OBSTACLE_WIDTH; // spawn off-screen right
	room.obstaclesByLane[laneIndex].push({ x, rowIndex });
	const { minInterval, maxInterval } = interpolateSpawns(room.elapsedMs);
	room.spawnStateByLane[laneIndex].nextSpawnAtMs = nowMs + Math.round(randomBetween(minInterval, maxInterval));
}

function resetGameState(room) {
	room.gameStarted = false;
	room.lastTickMs = 0;
	room.elapsedMs = 0;
	room.speedPxPerSec = BASE_SPEED;
	room.distancePx = 0;
	room.obstaclesByLane = [[], []];
	room.spawnStateByLane = [createSpawnState(), createSpawnState()];
	room.readyForRestart.clear();
	for (const player of room.players.values()) {
		player.rowIndex = 1;
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

	const dx = (room.speedPxPerSec * dtMs) / 1000;
	room.distancePx += dx;

	// spawn obstacles if needed
	for (let laneIndex = 0; laneIndex < 2; laneIndex += 1) {
		const spawnState = room.spawnStateByLane[laneIndex];
		if (spawnState.nextSpawnAtMs === 0) {
			// first spawn per lane after a short delay
			const { minInterval, maxInterval } = interpolateSpawns(room.elapsedMs);
			spawnState.nextSpawnAtMs = now + Math.round(randomBetween(minInterval, maxInterval));
		}
		if (now >= spawnState.nextSpawnAtMs) {
			spawnObstacle(room, laneIndex, now);
		}
	}

	// move obstacles and check collisions
	for (let laneIndex = 0; laneIndex < 2; laneIndex += 1) {
		const obstacles = room.obstaclesByLane[laneIndex];
		for (const obstacle of obstacles) {
			obstacle.x -= dx;
		}
		// remove obstacles that passed left edge
		while (obstacles.length > 0 && obstacles[0].x < -OBSTACLE_WIDTH - 10) {
			obstacles.shift();
		}
	}

	// collision detection
	const players = Array.from(room.players.values());
	for (const player of players) {
		if (!player.alive) continue;
		const laneIndex = player.laneIndex;
		const y = laneRowToY(player.rowIndex);
		const playerRect = { x: PLAYER_X, y, w: PLAYER_SIZE, h: PLAYER_SIZE };
		const obstacles = room.obstaclesByLane[laneIndex];
		for (const obstacle of obstacles) {
			const obstacleRect = { x: obstacle.x, y: laneRowToY(obstacle.rowIndex), w: OBSTACLE_WIDTH, h: OBSTACLE_HEIGHT };
			if (rectsOverlap(playerRect, obstacleRect)) {
				player.alive = false;
				break;
			}
		}
	}

	const alivePlayers = players.filter(p => p.alive);
	if (alivePlayers.length < players.length && room.gameStarted) {
		// at least one died -> end game
		stopGameLoop(room);
		let winnerLane = null;
		if (players[0] && players[1]) {
			if (players[0].alive && !players[1].alive) winnerLane = players[0].laneIndex;
			else if (!players[0].alive && players[1].alive) winnerLane = players[1].laneIndex;
			else winnerLane = -1; // tie
		}
		const payload = {
			distance: Math.round(room.distancePx),
			speed: Math.round(room.speedPxPerSec),
			winnerLane
		};
		io.to(room.id).emit('gameOver', payload);
		return; // do not emit state after game over
	}

	// broadcast state snapshot
	const snapshot = buildSnapshot(room);
	io.to(room.id).emit('state', snapshot);
}

function rectsOverlap(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildSnapshot(room) {
	const players = Array.from(room.players.values()).map(p => ({
		laneIndex: p.laneIndex,
		rowIndex: p.rowIndex,
		alive: p.alive
	}));
	return {
		canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
		playerX: PLAYER_X,
		playerSize: PLAYER_SIZE,
		obstacleSize: { w: OBSTACLE_WIDTH, h: OBSTACLE_HEIGHT },
		rowsPerLane: ROWS_PER_LANE,
		obstaclesByLane: room.obstaclesByLane,
		players,
		speed: Math.round(room.speedPxPerSec),
		distance: Math.round(room.distancePx),
		elapsedMs: room.elapsedMs
	};
}

io.on('connection', (socket) => {
	// matchmaking: pair with waiting player or wait
	let assignedRoom = null;
	if (waitingSocketId && waitingSocketId !== socket.id) {
		const roomId = String(nextRoomId++);
		const room = createEmptyRoom(roomId);
		rooms.set(roomId, room);

		room.socketIds.push(waitingSocketId);
		room.socketIds.push(socket.id);

		const laneA = 0;
		const laneB = 1;

		room.players.set(waitingSocketId, createPlayer(waitingSocketId, laneA));
		room.players.set(socket.id, createPlayer(socket.id, laneB));

		socket.join(roomId);
		io.sockets.sockets.get(waitingSocketId)?.join(roomId);

		assignedRoom = room;
		waitingSocketId = null;

		// notify both
		for (const sid of room.socketIds) {
			io.to(sid).emit('matchFound', { roomId, laneIndex: room.players.get(sid).laneIndex });
		}

		resetGameState(room);
		startGameLoop(room);
		io.to(roomId).emit('gameStart', { roomId });
	} else {
		waitingSocketId = socket.id;
		socket.emit('waiting', { message: 'Waiting for another player to join...' });
	}

	socket.on('input', (payload) => {
		const room = findRoomBySocket(socket.id);
		if (!room || !room.gameStarted) return;
		const player = room.players.get(socket.id);
		if (!player || !player.alive) return;
		if (payload?.type === 'move') {
			if (payload.direction === 'up') {
				player.rowIndex = clamp(player.rowIndex - 1, 0, ROWS_PER_LANE - 1);
			} else if (payload.direction === 'down') {
				player.rowIndex = clamp(player.rowIndex + 1, 0, ROWS_PER_LANE - 1);
			}
		}
	});

	socket.on('requestRestart', () => {
		const room = findRoomBySocket(socket.id);
		if (!room) return;
		room.readyForRestart.add(socket.id);
		io.to(room.id).emit('playerReady', { socketId: socket.id, readyCount: room.readyForRestart.size });
		if (room.readyForRestart.size === room.socketIds.length && room.socketIds.length === 2) {
			resetGameState(room);
			startGameLoop(room);
			io.to(room.id).emit('gameStart', { roomId: room.id });
		}
	});

	socket.on('disconnect', () => {
		if (waitingSocketId === socket.id) {
			waitingSocketId = null;
			return;
		}
		const room = findRoomBySocket(socket.id);
		if (!room) return;
		// remove from room
		room.socketIds = room.socketIds.filter((sid) => sid !== socket.id);
		room.players.delete(socket.id);

		// if game running and opponent exists, opponent wins immediately
		if (room.gameStarted && room.socketIds.length === 1) {
			stopGameLoop(room);
			io.to(room.id).emit('opponentDisconnected');
		}

		// clean up room if empty
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