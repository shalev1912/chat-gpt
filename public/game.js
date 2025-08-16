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
	const modeBar = document.querySelector('.mode-bar');

	let laneIndex = null; // 0 or 1 assigned by server
	let latestState = null;
	let isGameRunning = false;
	let mode = null; // 'single' | 'multi'
	let frameCount = 0; // animation tick

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
		if (modeBar) modeBar.style.display = 'flex';
	});

	socket.on('connect', () => {
		statusEl.textContent = 'מחובר. בחר מצב משחק';
		if (modeBar) modeBar.style.display = 'flex';
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
		if (modeBar) modeBar.style.display = 'none';
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
		}
		statusEl.textContent = msg;
		restartBtn.disabled = false;
		if (modeBar) modeBar.style.display = 'flex';
	});

	socket.on('opponentDisconnected', () => {
		isGameRunning = false;
		statusEl.textContent = 'היריב התנתק. לחץ התחלה מחדש כדי לשחק שוב.';
		restartBtn.disabled = false;
		if (modeBar) modeBar.style.display = 'flex';
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
			frameCount++;
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
		const laneWidth = canvas.width / s.numLanes;
		const colWidth = laneWidth / s.colsPerTrack;

		// lane backgrounds + separators
		for (let lane = 0; lane < s.numLanes; lane += 1) {
			const x0 = lane * laneWidth;
			ctx.fillStyle = lane % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'rgba(17,24,39,0.35)';
			ctx.fillRect(x0, 0, laneWidth, canvas.height);
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

		// scrolling dashed road lines
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

		// obstacles: draw cones/barrels with simple vector art
		for (let laneIdx = 0; laneIdx < s.obstaclesByLane.length; laneIdx += 1) {
			const obstacles = s.obstaclesByLane[laneIdx];
			for (const ob of obstacles) {
				const x = Math.round(laneIdx * laneWidth + ob.colIndex * colWidth + (colWidth - s.obstacleSize.w) / 2);
				const y = ob.y;
				if (ob.type === 'barrel') drawBarrel(ctx, x, y, s.obstacleSize.w, s.obstacleSize.h);
				else drawCone(ctx, x, y, s.obstacleSize.w, s.obstacleSize.h);
			}
		}

		// players: draw rounded car-like shape with subtle bobbing
		for (const p of s.players) {
			const x = Math.round(p.laneIndex * laneWidth + p.colIndex * colWidth + (colWidth - s.playerSize) / 2);
			const baseY = s.playerY;
			const bob = Math.round(Math.sin((frameCount + (laneIndex === p.laneIndex ? 0 : 20)) / 10) * 2);
			const y = baseY + bob;
			drawCar(ctx, x, y, s.playerSize, s.playerSize, laneIndex === p.laneIndex ? '#22d3ee' : '#a78bfa', !p.alive);
		}
	}

	function drawCone(ctx, x, y, w, h) {
		// shadow
		ctx.fillStyle = 'rgba(2,6,23,0.55)';
		ctx.fillRect(x + 4, y + h - 4, w, 6);
		// base
		ctx.fillStyle = '#ea580c';
		ctx.beginPath();
		ctx.moveTo(x + w * 0.1, y + h);
		ctx.lineTo(x + w * 0.5, y);
		ctx.lineTo(x + w * 0.9, y + h);
		ctx.closePath();
		ctx.fill();
		// stripes
		ctx.fillStyle = '#fde68a';
		ctx.fillRect(x + w * 0.3, y + h * 0.55, w * 0.4, h * 0.1);
		ctx.fillRect(x + w * 0.25, y + h * 0.75, w * 0.5, h * 0.1);
	}

	function drawBarrel(ctx, x, y, w, h) {
		// shadow
		ctx.fillStyle = 'rgba(2,6,23,0.55)';
		ctx.fillRect(x + 4, y + h - 4, w, 6);
		// body
		const grd = ctx.createLinearGradient(x, y, x, y + h);
		grd.addColorStop(0, '#6b7280');
		grd.addColorStop(1, '#374151');
		ctx.fillStyle = grd;
		roundRect(ctx, x, y, w, h, 8);
		ctx.fill();
		// bands
		ctx.fillStyle = 'rgba(31,41,55,0.7)';
		ctx.fillRect(x, y + h * 0.3, w, 6);
		ctx.fillRect(x, y + h * 0.6, w, 6);
	}

	function drawCar(ctx, x, y, w, h, color, isDead) {
		// shadow
		ctx.fillStyle = 'rgba(2,6,23,0.55)';
		ctx.fillRect(x + 3, y + h - 2, w, 6);
		// body
		const body = ctx.createLinearGradient(x, y, x, y + h);
		body.addColorStop(0, lighten(color, 0.15));
		body.addColorStop(1, color);
		ctx.fillStyle = body;
		roundRect(ctx, x, y, w, h, 10);
		ctx.fill();
		// windshield
		ctx.fillStyle = 'rgba(148,163,184,0.7)';
		roundRect(ctx, x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.25, 6);
		ctx.fill();
		// lights
		ctx.fillStyle = '#fde68a';
		ctx.fillRect(x + w * 0.1, y + h * 0.02, w * 0.2, 4);
		ctx.fillRect(x + w * 0.7, y + h * 0.02, w * 0.2, 4);
		// damage overlay
		if (isDead) {
			ctx.fillStyle = 'rgba(239,68,68,0.5)';
			roundRect(ctx, x, y, w, h, 10);
			ctx.fill();
		}
	}

	function roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	function lighten(hex, amount) {
		try {
			const c = hexToRgb(hex);
			c.r = Math.min(255, Math.round(c.r + 255 * amount));
			c.g = Math.min(255, Math.round(c.g + 255 * amount));
			c.b = Math.min(255, Math.round(c.b + 255 * amount));
			return rgbToHex(c.r, c.g, c.b);
		} catch {
			return hex;
		}
	}
	function hexToRgb(hex) {
		hex = hex.replace('#', '');
		const bigint = parseInt(hex, 16);
		return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
	}
	function rgbToHex(r, g, b) {
		return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
	}
})();