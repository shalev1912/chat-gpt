(() => {
	const socket = io();

	const canvas = document.getElementById('game');
	const ctx = canvas.getContext('2d');
	const statusEl = document.getElementById('status');
	const speedEl = document.getElementById('speed');
	const distanceEl = document.getElementById('distance');
	const restartBtn = document.getElementById('restart');
	const btnSingle = document.getElementById('btnSingle');
	const btnMulti = document.getElementById('btnMulti');
	const btnLeft = document.getElementById('btnLeft');
	const btnRight = document.getElementById('btnRight');

	let laneIndex = null; // 0 or 1 assigned by server
	let latestState = null;
	let isGameRunning = false;
	let mode = null; // 'single' | 'multi'

	if (btnSingle) btnSingle.addEventListener('click', () => socket.emit('startSingle'));
	if (btnMulti) btnMulti.addEventListener('click', () => socket.emit('startMultiplayer'));

	restartBtn.addEventListener('click', () => {
		restartBtn.disabled = true;
		socket.emit('requestRestart');
	});

	if (btnLeft) btnLeft.addEventListener('click', () => { if (isGameRunning) socket.emit('input', { type: 'move', direction: 'left' }); });
	if (btnRight) btnRight.addEventListener('click', () => { if (isGameRunning) socket.emit('input', { type: 'move', direction: 'right' }); });

	let touchStartX = null;
	canvas.addEventListener('touchstart', (e) => {
		if (!isGameRunning) return;
		if (e.touches && e.touches.length > 0) touchStartX = e.touches[0].clientX;
	}, { passive: true });
	canvas.addEventListener('touchend', (e) => {
		if (!isGameRunning || touchStartX == null) return;
		const t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null;
		if (!t) return;
		const dx = t.clientX - touchStartX;
		const TH = 25;
		if (Math.abs(dx) >= TH) socket.emit('input', { type: 'move', direction: dx < 0 ? 'left' : 'right' });
		touchStartX = null;
	}, { passive: true });

	document.addEventListener('keydown', (e) => {
		if (!isGameRunning) return;
		if (e.key === 'ArrowLeft') { socket.emit('input', { type: 'move', direction: 'left' }); e.preventDefault(); }
		else if (e.key === 'ArrowRight') { socket.emit('input', { type: 'move', direction: 'right' }); e.preventDefault(); }
	});

	socket.on('readyToChooseMode', () => {
		statusEl.textContent = 'בחר מצב משחק';
	});

	socket.on('connect', () => {
		statusEl.textContent = 'מחובר. בחר מצב משחק';
	});

	socket.on('waiting', (payload) => {
		statusEl.textContent = payload?.message || 'ממתין לשחקן נוסף...';
	});

	socket.on('matchFound', ({ roomId, laneIndex: myLane, mode: m }) => {
		laneIndex = myLane;
		mode = m;
		statusEl.textContent = m === 'single' ? 'מצב שחקן אחד התחיל' : `נמצא משחק בחדר ${roomId}. המסלול שלך: ${laneIndex === 0 ? 'שמאלי' : 'ימני'}`;
	});

	socket.on('gameStart', ({ mode: m }) => {
		statusEl.textContent = 'המשחק התחיל!';
		restartBtn.disabled = true;
		isGameRunning = true;
		mode = m || mode;
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
		if (mode === 'multi') {
			if (winnerLane === -1) msg += ' | תיקו';
			else if (winnerLane === laneIndex) msg += ' | ניצחת!';
			else msg += ' | הפסדת';
		} else {
			msg += '';
		}
		statusEl.textContent = msg;
		restartBtn.disabled = false;
	});

	socket.on('opponentDisconnected', () => {
		isGameRunning = false;
		statusEl.textContent = 'היריב התנתק. לחץ התחלה מחדש כדי לשחק שוב.';
		restartBtn.disabled = false;
	});

	socket.on('playerReady', ({ readyCount }) => {
		statusEl.textContent = mode === 'multi' ? `המתן... ${readyCount}/2 מוכנים` : 'מוכן להתחלה';
	});

	let animationRequested = false;
	let roadScroll = 0; // for lane line animation
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
		if (canvas.width !== s.canvas.width || canvas.height !== s.canvas.height) {
			canvas.width = s.canvas.width;
			canvas.height = s.canvas.height;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// background gradient already in CSS; draw tracks overlay
		const laneWidth = canvas.width / s.numLanes;
		const colWidth = laneWidth / s.colsPerTrack;

		// draw lane backgrounds subtle
		for (let lane = 0; lane < s.numLanes; lane += 1) {
			const x0 = lane * laneWidth;
			ctx.fillStyle = lane % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'rgba(17,24,39,0.35)';
			ctx.fillRect(x0, 0, laneWidth, canvas.height);
			// draw columns separators
			ctx.strokeStyle = 'rgba(148,163,184,0.2)';
			ctx.lineWidth = 2;
			for (let c = 1; c < s.colsPerTrack; c += 1) {
				const x = Math.round(x0 + c * colWidth);
				ctx.beginPath();
				ctx.moveTo(x, 12);
				ctx.lineTo(x, canvas.height - 12);
				ctx.stroke();
			}
		}

		// scrolling dashed road lines inside each column for motion feel
		roadScroll = (roadScroll + Math.max(2, Math.floor(s.speed / 60))) % 40;
		ctx.strokeStyle = 'rgba(203,213,225,0.35)';
		ctx.lineWidth = 4;
		ctx.setLineDash([16, 16]);
		for (let lane = 0; lane < s.numLanes; lane += 1) {
			const x0 = lane * laneWidth;
			for (let c = 0; c < s.colsPerTrack; c += 1) {
				const cx = Math.round(x0 + c * colWidth + colWidth / 2);
				ctx.beginPath();
				ctx.moveTo(cx, -40 + roadScroll);
				ctx.lineTo(cx, canvas.height + 40 + roadScroll);
				ctx.stroke();
			}
		}
		ctx.setLineDash([]);

		// draw obstacles
		for (let laneIdx = 0; laneIdx < s.obstaclesByLane.length; laneIdx += 1) {
			const obstacles = s.obstaclesByLane[laneIdx];
			for (const ob of obstacles) {
				const x = Math.round(laneIdx * laneWidth + ob.colIndex * colWidth + (colWidth - s.obstacleSize.w) / 2);
				const y = ob.y;
				// obstacle shadow
				ctx.fillStyle = 'rgba(2,6,23,0.6)';
				ctx.fillRect(x + 4, y + 6, s.obstacleSize.w, s.obstacleSize.h);
				// obstacle body
				const gradient = ctx.createLinearGradient(x, y, x, y + s.obstacleSize.h);
				gradient.addColorStop(0, '#f59e0b');
				gradient.addColorStop(1, '#b45309');
				ctx.fillStyle = gradient;
				ctx.fillRect(x, y, s.obstacleSize.w, s.obstacleSize.h);
				// highlight
				ctx.fillStyle = 'rgba(255,255,255,0.15)';
				ctx.fillRect(x, y, s.obstacleSize.w, 6);
			}
		}

		// draw players
		for (const p of s.players) {
			const x = Math.round(p.laneIndex * laneWidth + p.colIndex * colWidth + (colWidth - s.playerSize) / 2);
			const y = s.playerY;
			// player shadow
			ctx.fillStyle = 'rgba(2,6,23,0.6)';
			ctx.fillRect(x + 3, y + 8, s.playerSize, s.playerSize);
			// player body
			ctx.fillStyle = (laneIndex === p.laneIndex) ? '#22d3ee' : '#a78bfa';
			ctx.fillRect(x, y, s.playerSize, s.playerSize);
			if (!p.alive) {
				ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
				ctx.fillRect(x, y, s.playerSize, s.playerSize);
			}
		}
	}
})();