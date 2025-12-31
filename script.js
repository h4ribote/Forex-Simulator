/**
 * Core Application Logic
 */
const App = {
    data: [], // Full CSV data
    currentIndex: 0, // Current simulation cursor

    // Trading State
    balance: 1000000,
    positions: [],
    spread: 0.003, // Fixed spread simulation (0.3 pips)

    // Playback
    isPlaying: false,
    speed: 200,
    timer: null,

    // Chart Config
    visibleCandles: 60,
    candleWidth: 0,
    canvas: null,
    ctx: null,
    height: 0,
    width: 0,

    elements: {},

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.renderLoop(); // Start render loop
    },

    cacheElements() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            loader: document.getElementById('loader'),
            canvas: document.getElementById('mainCanvas'),
            chartContainer: document.getElementById('chartContainer'),
            balance: document.getElementById('balanceDisplay'),
            equity: document.getElementById('equityDisplay'),
            date: document.getElementById('currentDateDisplay'),
            price: document.getElementById('currentPriceDisplay'),
            bidDisplay: document.getElementById('bidDisplay'),
            askDisplay: document.getElementById('askDisplay'),
            pnl: document.getElementById('totalPnlDisplay'),
            positions: document.getElementById('positionList'),
            btnBuy: document.getElementById('btnBuy'),
            btnSell: document.getElementById('btnSell'),
            btnPlay: document.getElementById('btnPlayPause'),
            btnStep: document.getElementById('btnStep'),
            speedSelect: document.getElementById('speedSelect'),
            lotInput: document.getElementById('lotSize'),
            btnReset: document.getElementById('btnReset')
        };
        this.canvas = this.elements.canvas;
        this.ctx = this.canvas.getContext('2d');
    },

    setupEventListeners() {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        this.elements.btnPlay.addEventListener('click', () => this.togglePlay());
        this.elements.btnStep.addEventListener('click', () => {
            this.pause();
            this.nextCandle();
        });

        this.elements.speedSelect.addEventListener('change', (e) => {
            this.speed = parseInt(e.target.value);
            if (this.isPlaying) {
                this.pause();
                this.play();
            }
        });

        this.elements.btnBuy.addEventListener('click', () => this.openPosition('BUY'));
        this.elements.btnSell.addEventListener('click', () => this.openPosition('SELL'));

        this.elements.btnReset.addEventListener('click', () => {
            if(confirm('リセットしますか？')) {
                this.resetSim();
            }
        });

        // Simple touch/drag for chart scrolling (optional basic implementation)
        let isDragging = false;
        let lastX = 0;

        this.elements.chartContainer.addEventListener('mousedown', e => {
            isDragging = true;
            lastX = e.clientX;
        });
        window.addEventListener('mouseup', () => isDragging = false);
        this.elements.chartContainer.addEventListener('mousemove', e => {
            if (!isDragging || !this.data.length) return;
            const dx = e.clientX - lastX;
            if (Math.abs(dx) > 5) {
                // Determine direction
                // For simplicity in this version, dragging logic is minimal
                // Ideally, modify a 'scrollOffset' variable
                lastX = e.clientX;
            }
        });
    },

    resizeCanvas() {
        const rect = this.elements.chartContainer.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        // Handle High DPI
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);

        this.renderChart();
    },

    resetSim() {
        this.pause();
        this.currentIndex = 0;
        this.balance = 1000000;
        this.positions = [];
        this.updateUI();
        this.renderChart();
    },

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.elements.loader.style.display = 'flex';

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this.parseCSV(text);
        };
        reader.readAsText(file);
    },

    parseCSV(text) {
        // Expected format: Gmt time,Open,High,Low,Close,Volume
        // Sample: 03.11.2025 00:00:00.000,154.201,154.209,154.185,154.189,179.4

        const lines = text.trim().split('\n');
        const newData = [];

        // Regex for dd.mm.yyyy HH:MM:SS.ms
        const dateRegex = /(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/;

        // Start from 1 to skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',');
            if (cols.length < 5) continue;

            const timeStr = cols[0];
            const match = timeStr.match(dateRegex);

            let ts = 0;
            if (match) {
                // Date(year, monthIndex, day, hours, minutes, seconds)
                const d = new Date(match[3], match[2] - 1, match[1], match[4], match[5], match[6]);
                ts = d.getTime();
            } else {
                ts = new Date(timeStr).getTime(); // Fallback
            }

            newData.push({
                time: ts,
                timeStr: timeStr.substring(0, 16), // Show up to minutes
                open: parseFloat(cols[1]),
                high: parseFloat(cols[2]),
                low: parseFloat(cols[3]),
                close: parseFloat(cols[4])
            });
        }

        this.data = newData;
        this.currentIndex = Math.min(60, this.data.length - 1); // Start with some history

        this.elements.loader.style.display = 'none';

        // Enable buttons
        this.elements.btnBuy.classList.remove('btn-disabled');
        this.elements.btnSell.classList.remove('btn-disabled');

        this.renderChart();
        this.updateUI();

        // Auto play start
        // this.play();
    },

    // --- Simulation Logic ---

    togglePlay() {
        if (this.isPlaying) this.pause();
        else this.play();
    },

    play() {
        if (!this.data.length) return;
        this.isPlaying = true;
        this.elements.btnPlay.textContent = '⏸';

        this.timer = setInterval(() => {
            this.nextCandle();
        }, this.speed);
    },

    pause() {
        this.isPlaying = false;
        this.elements.btnPlay.textContent = '▶';
        clearInterval(this.timer);
    },

    nextCandle() {
        if (this.currentIndex >= this.data.length - 1) {
            this.pause();
            alert("データ終了");
            return;
        }
        this.currentIndex++;
        this.renderChart();
        this.updateUI();
    },

    // --- Trading Logic ---

    getCurrentPrice() {
        if (!this.data.length) return { bid: 0, ask: 0 };
        const candle = this.data[this.currentIndex];
        // Bid = Close, Ask = Close + Spread
        return {
            bid: candle.close,
            ask: candle.close + this.spread,
            time: candle.timeStr
        };
    },

    openPosition(type) {
        if (!this.data.length) return;

        const priceData = this.getCurrentPrice();
        const lotSize = parseFloat(this.elements.lotInput.value);
        // Standard Lot = 100,000 units usually, let's assume input is Lots.
        // If 0.1 Lot = 10,000 units.
        const units = lotSize * 100000;

        const entryPrice = type === 'BUY' ? priceData.ask : priceData.bid;

        const position = {
            id: Date.now(),
            type: type,
            lot: lotSize,
            units: units,
            entryPrice: entryPrice,
            time: priceData.time
        };

        this.positions.push(position);
        this.updateUI();
        this.renderPositions();
    },

    closePosition(id) {
        const index = this.positions.findIndex(p => p.id === id);
        if (index === -1) return;

        const pos = this.positions[index];
        const currentPrices = this.getCurrentPrice();
        const exitPrice = pos.type === 'BUY' ? currentPrices.bid : currentPrices.ask;

        // Calculate PnL: (Exit - Entry) * Units * Direction
        // Direction: Buy=1, Sell=-1
        const direction = pos.type === 'BUY' ? 1 : -1;
        const pnl = (exitPrice - pos.entryPrice) * pos.units * direction;

        this.balance += pnl;
        this.positions.splice(index, 1);

        this.updateUI();
        this.renderPositions();
    },

    // --- UI Updates ---

    updateUI() {
        if (!this.data.length) return;

        const prices = this.getCurrentPrice();

        // Update Header
        this.elements.date.textContent = prices.time;
        this.elements.price.textContent = prices.bid.toFixed(3);

        if (this.elements.bidDisplay) this.elements.bidDisplay.textContent = prices.bid.toFixed(3);
        if (this.elements.askDisplay) this.elements.askDisplay.textContent = prices.ask.toFixed(3);

        // Calc Unrealized PnL
        let totalUnrealizedPnl = 0;

        this.positions.forEach(pos => {
            const exitPrice = pos.type === 'BUY' ? prices.bid : prices.ask;
            const direction = pos.type === 'BUY' ? 1 : -1;
            const pnl = (exitPrice - pos.entryPrice) * pos.units * direction;
            totalUnrealizedPnl += pnl;
        });

        const equity = this.balance + totalUnrealizedPnl;

        this.elements.balance.textContent = Math.floor(this.balance).toLocaleString();
        this.elements.equity.textContent = Math.floor(equity).toLocaleString();
        this.elements.pnl.textContent = Math.floor(totalUnrealizedPnl).toLocaleString();

        // Color equity
        if(totalUnrealizedPnl > 0) this.elements.pnl.classList.add('pnl-plus');
        else if (totalUnrealizedPnl < 0) this.elements.pnl.classList.remove('pnl-plus'); // Simple logic

        // Update List Values (Realtime)
        this.renderPositions();
    },

    renderPositions() {
        const container = this.elements.positions;
        container.innerHTML = '';

        if (this.positions.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 mt-4 text-sm">ポジションはありません</div>';
            return;
        }

        const prices = this.getCurrentPrice();

        this.positions.slice().reverse().forEach(pos => {
            const exitPrice = pos.type === 'BUY' ? prices.bid : prices.ask;
            const direction = pos.type === 'BUY' ? 1 : -1;
            const pnl = (exitPrice - pos.entryPrice) * pos.units * direction;

            const pnlClass = pnl >= 0 ? 'pnl-plus' : 'pnl-minus';
            const typeClass = pos.type === 'BUY' ? 'text-green-400' : 'text-red-400';

            const item = document.createElement('div');
            item.className = 'pos-item';
            item.innerHTML = `
                <div class="${typeClass} font-bold">${pos.type}<br><span class="text-xs text-slate-500">${pos.lot} Lot</span></div>
                <div>${pos.entryPrice.toFixed(3)}</div>
                <div class="${pnlClass}">${Math.floor(pnl).toLocaleString()}</div>
                <button class="bg-slate-700 hover:bg-slate-600 border border-slate-500 px-2 py-1 rounded text-xs" onclick="App.closePosition(${pos.id})">決済</button>
            `;
            container.appendChild(item);
        });
    },

    // --- Chart Rendering ---

    renderChart() {
        if (!this.data.length || !this.ctx) return;

        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Determine view window
        const endIndex = this.currentIndex;
        const startIndex = Math.max(0, endIndex - this.visibleCandles);
        const viewData = this.data.slice(startIndex, endIndex + 1);

        if (viewData.length === 0) return;

        // Find Y Scale
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        viewData.forEach(d => {
            if (d.high > maxPrice) maxPrice = d.high;
            if (d.low < minPrice) minPrice = d.low;
        });

        // Add padding to Y axis
        const priceRange = maxPrice - minPrice;
        minPrice -= priceRange * 0.1;
        maxPrice += priceRange * 0.1;

        const getY = (price) => h - ((price - minPrice) / (maxPrice - minPrice)) * h;

        // Grid Lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();

        // Draw 5 horizontal grid lines
        for(let i=1; i<5; i++) {
            const p = minPrice + (priceRange * 1.2) * (i/5);
            const y = getY(p);
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);

            // Text
            ctx.fillStyle = '#64748b';
            ctx.font = '10px sans-serif';
            ctx.fillText(p.toFixed(2), w - 40, y - 5);
        }
        ctx.stroke();

        // Draw Candles
        const candleW = (w / this.visibleCandles) * 0.8;
        const spacing = (w / this.visibleCandles) * 0.2;

        viewData.forEach((d, i) => {
            const x = i * (candleW + spacing) + spacing/2;
            const openY = getY(d.open);
            const closeY = getY(d.close);
            const highY = getY(d.high);
            const lowY = getY(d.low);

            const isBullish = d.close >= d.open;

            ctx.fillStyle = isBullish ? '#22c55e' : '#ef4444'; // Green : Red
            ctx.strokeStyle = ctx.fillStyle;

            // Wick
            ctx.beginPath();
            ctx.moveTo(x + candleW/2, highY);
            ctx.lineTo(x + candleW/2, lowY);
            ctx.stroke();

            // Body
            // Ensure height is at least 1px
            let bodyH = Math.abs(closeY - openY);
            if (bodyH < 1) bodyH = 1;

            const topY = Math.min(openY, closeY);
            ctx.fillRect(x, topY, candleW, bodyH);
        });

        // Draw Current Price Line
        const currentClose = viewData[viewData.length-1].close;
        const curY = getY(currentClose);

        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(0, curY);
        ctx.lineTo(w, curY);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    renderLoop() {
        // Animation loop hook if needed for smoother transitions later
        // Currently rendering is triggered by state changes
        requestAnimationFrame(() => this.renderLoop());
    }
};

// Start
window.onload = () => App.init();
