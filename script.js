/**
 * Core Application Logic
 */
const App = {
    rawData: [], // Original 1-minute data
    data: [], // Aggregated data for display
    timeframe: 1, // Current timeframe in minutes
    currentRawIndex: 0, // Current simulation cursor (index in rawData)
    currentIndex: 0, // Current display cursor (index in data)

    // Trading State
    balance: 1000000,
    positions: [],
    spread: 0.003, // Fixed spread simulation (0.3 pips)

    // Playback
    isPlaying: false,
    speed: 200,
    timer: null,

    // Chart Config
    chart: null,
    candleSeries: null,

    elements: {},

    // Analysis State
    isAnalysisOpen: false,

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.initChart();
        this.renderLoop(); // Start render loop (mostly for UI updates if needed)
    },

    cacheElements() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            loader: document.getElementById('loader'),
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
            timeframeSelect: document.getElementById('timeframeSelect'),
            speedSelect: document.getElementById('speedSelect'),
            lotInput: document.getElementById('lotSize'),
            btnReset: document.getElementById('btnReset'),
            btnAnalysis: document.getElementById('btnAnalysis'),
            analysisModal: document.getElementById('analysisModal'),
            btnCloseAnalysis: document.getElementById('btnCloseAnalysis'),
            analysisContent: document.getElementById('analysisContent')
        };
    },

    initChart() {
        const chartOptions = {
            layout: {
                background: { type: 'solid', color: '#1e293b' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            timeScale: {
                borderColor: '#475569',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#475569',
            },
            width: this.elements.chartContainer.clientWidth,
            height: this.elements.chartContainer.clientHeight,
        };

        this.chart = LightweightCharts.createChart(this.elements.chartContainer, chartOptions);

        this.candleSeries = this.chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Handle Resize
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== this.elements.chartContainer) return;
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({ width: newRect.width, height: newRect.height });
        });
        resizeObserver.observe(this.elements.chartContainer);
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

        this.elements.timeframeSelect.addEventListener('change', (e) => {
            const newTimeframe = parseInt(e.target.value);
            this.setTimeframe(newTimeframe);
        });

        this.elements.btnBuy.addEventListener('click', () => this.openPosition('BUY'));
        this.elements.btnSell.addEventListener('click', () => this.openPosition('SELL'));

        this.elements.btnReset.addEventListener('click', () => {
            if(confirm('リセットしますか？')) {
                this.resetSim();
            }
        });

        this.elements.btnAnalysis.addEventListener('click', () => this.toggleAnalysis());
        this.elements.btnCloseAnalysis.addEventListener('click', () => this.toggleAnalysis());
    },

    toggleAnalysis() {
        this.isAnalysisOpen = !this.isAnalysisOpen;
        if (this.isAnalysisOpen) {
            this.elements.analysisModal.classList.remove('hidden');
            this.renderAnalysis();
        } else {
            this.elements.analysisModal.classList.add('hidden');
        }
    },

    renderAnalysis() {
        if (!this.isAnalysisOpen || !this.data.length) return;

        const analysis = TechnicalIndicators.analyze(this.data);
        if (!analysis) return;

        const getSignalColor = (action) => action === 'BUY' ? 'text-blue-400' : action === 'SELL' ? 'text-red-400' : 'text-slate-400';
        const getSignalText = (action) => action === 'BUY' ? '買い' : action === 'SELL' ? '売り' : action === null ? '-' : '中立';

        // Helper for gauge (simplified)
        const renderGauge = (title, data) => {
            let buy = 0, sell = 0, neutral = 0;
            data.forEach(d => {
                if (d.action === 'BUY') buy++;
                else if (d.action === 'SELL') sell++;
                else if (d.action === 'NEUTRAL') neutral++;
            });

            // Gauge CSS Logic (basic)
            const total = buy + sell + neutral;
            const score = total > 0 ? (buy - sell) / total : 0; // -1 to 1
            const deg = (score + 1) * 90; // 0 to 180

            return `
                <div class="bg-black/20 p-4 rounded text-center">
                    <h3 class="text-sm text-slate-300 mb-2">${title}</h3>
                    <div class="relative w-40 h-20 mx-auto overflow-hidden">
                        <div class="absolute w-40 h-40 rounded-full border-8 border-slate-700 top-0 left-0"></div>
                        <div class="absolute w-40 h-40 rounded-full border-8 border-transparent border-t-blue-500 top-0 left-0" style="transform: rotate(${score * 45}deg);"></div>
                        <div class="absolute bottom-0 left-1/2 w-1 h-20 bg-white origin-bottom transform -translate-x-1/2 rotate-[${score * 90}deg] transition-transform"></div>
                    </div>
                    <div class="flex justify-around mt-2 text-xs font-mono">
                        <div class="text-red-400">売り<br><span class="text-lg">${sell}</span></div>
                        <div class="text-slate-400">中立<br><span class="text-lg">${neutral}</span></div>
                        <div class="text-blue-400">買い<br><span class="text-lg">${buy}</span></div>
                    </div>
                </div>
            `;
        };

        const renderTable = (items) => {
            return items.map(item => `
                <div class="flex justify-between py-2 border-b border-slate-700 text-sm">
                    <span class="text-slate-300">${item.name}</span>
                    <div class="text-right">
                        <span class="font-mono mr-2">${item.value !== null ? item.value.toFixed(2) : '-'}</span>
                        <span class="${getSignalColor(item.action)} font-bold w-10 inline-block text-center">${getSignalText(item.action)}</span>
                    </div>
                </div>
            `).join('');
        };

        const html = `
            <div class="grid grid-cols-2 gap-4 mb-6">
                ${renderGauge('オシレーター', analysis.oscillators)}
                ${renderGauge('移動平均', analysis.movingAverages)}
            </div>

            <div class="space-y-6">
                <div>
                    <h3 class="text-sm font-bold text-slate-300 mb-2 border-b border-slate-600 pb-1">オシレーター</h3>
                    <div class="space-y-1">
                        ${renderTable(analysis.oscillators)}
                    </div>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-slate-300 mb-2 border-b border-slate-600 pb-1">移動平均</h3>
                    <div class="space-y-1">
                        ${renderTable(analysis.movingAverages)}
                    </div>
                </div>
            </div>
        `;

        this.elements.analysisContent.innerHTML = html;
    },

    resetSim() {
        this.pause();
        this.currentRawIndex = Math.min(60, this.rawData.length - 1);
        this.balance = 1000000;
        this.positions = [];
        this.setTimeframe(this.timeframe);
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
                // timeStr will be generated on demand or pre-calc if needed
                open: parseFloat(cols[1]),
                high: parseFloat(cols[2]),
                low: parseFloat(cols[3]),
                close: parseFloat(cols[4])
            });
        }

        this.rawData = newData;
        // Start with some history
        this.currentRawIndex = Math.min(60, this.rawData.length - 1);

        this.elements.loader.style.display = 'none';

        // Enable buttons
        this.elements.btnBuy.classList.remove('btn-disabled');
        this.elements.btnSell.classList.remove('btn-disabled');

        // Set initial timeframe
        this.setTimeframe(this.timeframe, true);
    },

    formatTime(ts) {
        const d = new Date(ts);
        const pad = (n) => n.toString().padStart(2, '0');
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hour = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${year}/${month}/${day} ${hour}:${min}`;
    },

    setTimeframe(minutes, isInit = false) {
        this.timeframe = minutes;
        // Rebuild aggregated data from rawData up to currentRawIndex
        this.data = this.aggregateData(minutes, this.currentRawIndex);

        // Ensure display cursor is at the end
        this.currentIndex = this.data.length - 1;

        this.updateChartData();
        this.updateUI();
    },

    aggregateData(minutes, upToIndex) {
        if (!this.rawData.length) return [];

        // Limit raw data to upToIndex
        const sourceData = this.rawData.slice(0, upToIndex + 1);

        if (minutes === 1) {
            return sourceData.map(c => ({
                ...c,
                timeStr: this.formatTime(c.time)
            }));
        }

        const aggregated = [];
        const intervalMs = minutes * 60 * 1000;

        let currentCandle = null;
        let bucketStartTime = 0;

        for (const candle of sourceData) {
            const candleTime = candle.time;
            const alignedTime = Math.floor(candleTime / intervalMs) * intervalMs;

            if (currentCandle && alignedTime !== bucketStartTime) {
                aggregated.push(currentCandle);
                currentCandle = null;
            }

            if (!currentCandle) {
                bucketStartTime = alignedTime;
                currentCandle = {
                    time: bucketStartTime,
                    timeStr: this.formatTime(bucketStartTime),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                };
            } else {
                currentCandle.high = Math.max(currentCandle.high, candle.high);
                currentCandle.low = Math.min(currentCandle.low, candle.low);
                currentCandle.close = candle.close;
            }
        }
        if (currentCandle) {
            aggregated.push(currentCandle);
        }
        return aggregated;
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

        const interval = this.speed * this.timeframe; // Adjust timing based on speed
        // NOTE: If speed is "ms per candle update", we should just use speed directly.
        // The original code used speed * timeframe which implies higher timeframe = slower updates?
        // Let's stick to simple speed for now.
        // Actually, if we want to simulate "1 tick per X ms", we should just call nextCandle.

        this.timer = setInterval(() => {
            this.nextCandle();
        }, this.speed); // Using raw speed value for interval
    },

    pause() {
        this.isPlaying = false;
        this.elements.btnPlay.textContent = '▶';
        clearInterval(this.timer);
    },

    nextCandle() {
        if (this.currentRawIndex >= this.rawData.length - 1) {
            this.pause();
            alert("データ終了");
            return;
        }
        this.currentRawIndex++;

        // Update aggregated data incrementally
        const rawCandle = this.rawData[this.currentRawIndex];
        const intervalMs = this.timeframe * 60 * 1000;
        const bucketTime = Math.floor(rawCandle.time / intervalMs) * intervalMs;

        // Check if last aggregated candle corresponds to this bucket
        const lastAgg = this.data.length > 0 ? this.data[this.data.length - 1] : null;

        if (lastAgg && lastAgg.time === bucketTime) {
            // Update existing candle
            lastAgg.high = Math.max(lastAgg.high, rawCandle.high);
            lastAgg.low = Math.min(lastAgg.low, rawCandle.low);
            lastAgg.close = rawCandle.close;
        } else {
            // Start new candle
            this.data.push({
                time: bucketTime,
                timeStr: this.formatTime(bucketTime),
                open: rawCandle.open,
                high: rawCandle.high,
                low: rawCandle.low,
                close: rawCandle.close
            });
        }

        // Ensure chart shows latest
        this.currentIndex = this.data.length - 1;

        // Update Chart via API
        const currentCandle = this.data[this.data.length - 1];
        // Convert to seconds for TradingView
        const tvCandle = {
            ...currentCandle,
            time: currentCandle.time / 1000
        };
        this.candleSeries.update(tvCandle);

        // Keep latest in view if playing
        // this.chart.timeScale().scrollToPosition(0, false); // Optional: keep rightmost visible

        this.updateUI();
        if (this.isAnalysisOpen) this.renderAnalysis();
    },

    // --- Trading Logic ---

    getCurrentPrice() {
        // Price should be based on current RAW candle (most granular)
        if (!this.rawData.length) return { bid: 0, ask: 0 };
        const candle = this.rawData[this.currentRawIndex];
        // Bid = Close, Ask = Close + Spread
        return {
            bid: candle.close,
            ask: candle.close + this.spread,
            time: this.formatTime(candle.time)
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

    updateChartData() {
        if (!this.candleSeries) return;

        // Map data to TradingView format (time in seconds)
        const tvData = this.data.map(d => ({
            time: d.time / 1000,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));

        this.candleSeries.setData(tvData);
    },

    renderLoop() {
        // Kept if we need independent animation loop,
        // but mostly event-driven now.
        // requestAnimationFrame(() => this.renderLoop());
    }
};

// Start
window.onload = () => App.init();
