(() => {
	const socket = io();

	const canvas = document.getElementById('game');
	const ctx = canvas.getContext('2d');
	const statusEl = document.getElementById('status');
	const speedEl = document.getElementById('speed');
	const distanceEl = document.getElementById('distance');
	const restartBtn = document.getElementById('restart');
	const btnUp = document.getElementById('btnUp');
	const btnDown = document.getElementById('btnDown');

	let laneIndex = null; // 0 or 1 assigned by server
	let latestState = null;
	let isGameRunning = false;
	let isWaiting = false;

	restartBtn.addEventListener('click', () => {
		restartBtn.disabled = true;
		socket.emit('requestRestart');
	});

	if (btnUp) {
		btnUp.addEventListener('click', () => {
			if (!isGameRunning) return;
			socket.emit('input', { type: 'move', direction: 'up' });
		});
	}
	if (btnDown) {
		btnDown.addEventListener('click', () => {
			if (!isGameRunning) return;
			socket.emit('input', { type: 'move', direction: 'down' });
		});
	}

	let touchStartY = null;
	canvas.addEventListener('touchstart', (e) => {
		if (!isGameRunning) return;
		if (e.touches && e.touches.length > 0) {
			touchStartY = e.touches[0].clientY;
		}
	}, { passive: true });
	canvas.addEventListener('touchend', (e) => {
		if (!isGameRunning) return;
		if (touchStartY == null) return;
		const t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : (e.touches && e.touches[0] ? e.touches[0] : null);
		if (!t) return;
		const dy = t.clientY - touchStartY;
		const THRESHOLD = 25;
		if (Math.abs(dy) >= THRESHOLD) {
			const dir = dy < 0 ? 'up' : 'down';
			socket.emit('input', { type: 'move', direction: dir });
		}
		touchStartY = null;
	}, { passive: true });

	document.addEventListener('keydown', (e) => {
		if (!isGameRunning) return;
		if (e.key === 'ArrowUp') {
			socket.emit('input', { type: 'move', direction: 'up' });
			e.preventDefault();
		} else if (e.key === 'ArrowDown') {
			socket.emit('input', { type: 'move', direction: 'down' });
			e.preventDefault();
		}
	});

	socket.on('connect', () => {
		statusEl.textContent = 'מחובר. מחפש יריב...';
	});

	socket.on('waiting', (payload) => {
		statusEl.textContent = payload?.message || 'ממתין לשחקן נוסף...';
		isWaiting = true;
	});

	socket.on('matchFound', ({ roomId, laneIndex: myLane }) => {
		laneIndex = myLane;
		statusEl.textContent = `נמצא משחק בחדר ${roomId}. המסלול שלך: ${laneIndex === 0 ? 'שמאלי' : 'ימני'}`;
		isWaiting = false;
	});

	socket.on('gameStart', () => {
		statusEl.textContent = 'המשחק התחיל!';
		restartBtn.disabled = true;
		isGameRunning = true;
	});

	socket.on('state', (snapshot) => {
		latestState = snapshot;
		speedEl.textContent = snapshot.speed;
		distanceEl.textContent = snapshot.distance;
		requestRender();
	});

	socket.on('gameOver', ({ distance, speed, winnerLane }) => {
		isGameRunning = false;
		let msg = `סיום! מרחק: ${distance}, מהירות: ${speed}`;
		if (winnerLane === -1) msg += ' | תיקו';
		else if (winnerLane === laneIndex) msg += ' | ניצחת!';
		else msg += ' | הפסדת';
		statusEl.textContent = msg;
		restartBtn.disabled = false;
	});

	socket.on('opponentDisconnected', () => {
		isGameRunning = false;
		statusEl.textContent = 'היריב התנתק. לחץ התחלה מחדש כדי לחכות ליריב חדש.';
		restartBtn.disabled = false;
	});

	socket.on('playerReady', ({ readyCount }) => {
		statusEl.textContent = `המתן... ${readyCount}/2 מוכנים`;
	});

	let animationRequested = false;
	function requestRender() {
		if (animationRequested) return;
		animationRequested = true;
		window.requestAnimationFrame(() => {
			animationRequested = false;
			render();
		});
	}

	function render() {
		const s = latestState;
		if (!s) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			return;
		}
		// ensure canvas matches server size
		if (canvas.width !== s.canvas.width || canvas.height !== s.canvas.height) {
			canvas.width = s.canvas.width;
			canvas.height = s.canvas.height;
		}

		// background
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#0b1220';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// draw lanes background
		const laneWidth = canvas.width / 2;
		// left (lane 0)
		ctx.fillStyle = '#0f1a2a';
		ctx.fillRect(0, 0, laneWidth, canvas.height);
		// right (lane 1)
		ctx.fillStyle = '#0d1625';
		ctx.fillRect(laneWidth, 0, laneWidth, canvas.height);

		// draw rows separators
		const trackTop = 60;
		const trackBottom = canvas.height - 60;
		const trackHeight = trackBottom - trackTop;
		const rowHeight = trackHeight / s.rowsPerLane;
		ctx.strokeStyle = '#1f2a3a';
		ctx.lineWidth = 2;
		for (let i = 1; i < s.rowsPerLane; i += 1) {
			const y = Math.round(trackTop + rowHeight * i);
			ctx.beginPath();
			ctx.moveTo(16, y);
			ctx.lineTo(canvas.width - 16, y);
			ctx.stroke();
		}

		// center divider
		ctx.strokeStyle = '#243449';
		ctx.setLineDash([10, 10]);
		ctx.beginPath();
		ctx.moveTo(laneWidth, 16);
		ctx.lineTo(laneWidth, canvas.height - 16);
		ctx.stroke();
		ctx.setLineDash([]);

		// draw players
		for (const p of s.players) {
			const isMe = laneIndex === p.laneIndex;
			const x = s.playerX + (p.laneIndex === 1 ? laneWidth : 0);
			const y = rowIndexToY(p.rowIndex, s);
			ctx.fillStyle = isMe ? '#22d3ee' : '#a78bfa';
			ctx.fillRect(x, y, s.playerSize, s.playerSize);
			if (!p.alive) {
				ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
				ctx.fillRect(x, y, s.playerSize, s.playerSize);
			}
		}

		// draw obstacles
		for (let laneIdx = 0; laneIdx < s.obstaclesByLane.length; laneIdx += 1) {
			const obstacles = s.obstaclesByLane[laneIdx];
			for (const ob of obstacles) {
				const x = ob.x + (laneIdx === 1 ? laneWidth : 0);
				const y = rowIndexToY(ob.rowIndex, s);
				ctx.fillStyle = '#f59e0b';
				ctx.fillRect(x, y, s.obstacleSize.w, s.obstacleSize.h);
			}
		}

		// speed and distance are updated in HUD elements
	}

	function rowIndexToY(rowIndex, s) {
		const trackTop = 60;
		const trackHeight = s.canvas.height - 120;
		const rowHeight = trackHeight / s.rowsPerLane;
		return Math.round(trackTop + rowHeight * rowIndex + (rowHeight - s.playerSize) / 2);
	}
})();