/**
 * Technical Analysis Library for FX Simulator
 */
class TechnicalIndicators {

    static analyze(candles) {
        if (!candles || candles.length < 100) return null;

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const currentPrice = closes[closes.length - 1];

        const oscillators = [];
        const movingAverages = [];

        // --- Oscillators ---

        // RSI
        const rsi = this.rsi(closes, 14);
        oscillators.push(this.format('RSI (14)', rsi, this.checkRsi(rsi)));

        // Stoch
        const stoch = this.stoch(highs, lows, closes, 14, 3, 3);
        oscillators.push(this.format('Stoch %K (14, 3, 3)', stoch.k, this.checkStoch(stoch.k)));

        // CCI
        const cci = this.cci(highs, lows, closes, 20);
        oscillators.push(this.format('CCI (20)', cci, this.checkCci(cci)));

        // ADX
        const adx = this.adx(highs, lows, closes, 14);
        oscillators.push(this.format('ADX (14)', adx.adx, this.checkAdx(adx)));

        // AO
        const ao = this.ao(highs, lows);
        oscillators.push(this.format('AO', ao, this.checkZero(ao)));

        // MOM
        const mom = this.mom(closes, 10);
        oscillators.push(this.format('Mom (10)', mom, this.checkZero(mom)));

        // MACD
        const macd = this.macd(closes, 12, 26, 9);
        oscillators.push(this.format('MACD (12, 26)', macd.hist, this.checkZero(macd.hist)));

        // StochRSI
        const stochRsi = this.stochRsi(closes, 14, 14, 3, 3);
        oscillators.push(this.format('Stoch RSI (3, 3, 14, 14)', stochRsi.k, this.checkStoch(stochRsi.k)));

        // WPR
        const wpr = this.wpr(highs, lows, closes, 14);
        oscillators.push(this.format('WPR (14)', wpr, this.checkWpr(wpr)));

        // BBP
        const bbp = this.bbp(highs, lows, closes, 13);
        oscillators.push(this.format('BBP (13)', bbp, this.checkZero(bbp)));

        // UO
        const uo = this.uo(highs, lows, closes, 7, 14, 28);
        oscillators.push(this.format('UO (7, 14, 28)', uo, this.checkRsi(uo)));

        // --- Moving Averages ---
        [10, 20, 30, 50, 100].forEach(p => {
            const sma = this.sma(closes, p);
            movingAverages.push(this.format(`SMA (${p})`, sma, this.checkMa(currentPrice, sma)));

            const ema = this.ema(closes, p);
            movingAverages.push(this.format(`EMA (${p})`, ema, this.checkMa(currentPrice, ema)));
        });

        return { oscillators, movingAverages };
    }

    static format(name, value, action) {
        return { name, value, action };
    }

    // --- Action Checks ---
    static checkRsi(v) { return v < 30 ? 'BUY' : v > 70 ? 'SELL' : 'NEUTRAL'; }
    static checkStoch(v) { return v < 20 ? 'BUY' : v > 80 ? 'SELL' : 'NEUTRAL'; }
    static checkCci(v) { return v < -100 ? 'BUY' : v > 100 ? 'SELL' : 'NEUTRAL'; }
    static checkAdx(v) { return (v.adx > 25 && v.pdi > v.mdi) ? 'BUY' : (v.adx > 25 && v.mdi > v.pdi) ? 'SELL' : 'NEUTRAL'; }
    static checkZero(v) { return v > 0 ? 'BUY' : v < 0 ? 'SELL' : 'NEUTRAL'; }
    static checkWpr(v) { return v < -80 ? 'BUY' : v > -20 ? 'SELL' : 'NEUTRAL'; }
    static checkMa(price, ma) { return price > ma ? 'BUY' : 'SELL'; }

    // --- Calculations ---

    static sma(data, len) {
        if (data.length < len) return 0;
        let sum = 0;
        for (let i = 0; i < len; i++) sum += data[data.length - 1 - i];
        return sum / len;
    }

    static ema(data, len) {
        if (data.length < len) return 0;
        const k = 2 / (len + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }

    static rsi(data, len) {
        if (data.length < len + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = 1; i <= len; i++) {
            const d = data[i] - data[i - 1];
            if (d > 0) gains += d; else losses -= d;
        }
        let avgGain = gains / len;
        let avgLoss = losses / len;

        for (let i = len + 1; i < data.length; i++) {
            const d = data[i] - data[i - 1];
            if (d > 0) {
                avgGain = (avgGain * (len - 1) + d) / len;
                avgLoss = (avgLoss * (len - 1)) / len;
            } else {
                avgGain = (avgGain * (len - 1)) / len;
                avgLoss = (avgLoss * (len - 1) - d) / len;
            }
        }
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }

    static stoch(highs, lows, closes, period, kSmooth, dSmooth) {
        const rawKs = [];
        const len = closes.length;
        const needed = period + kSmooth + dSmooth + 50;
        const start = Math.max(0, len - needed);

        for (let i = start; i < len; i++) {
            if (i < period - 1) { rawKs.push(50); continue; }
            const h = Math.max(...highs.slice(i - period + 1, i + 1));
            const l = Math.min(...lows.slice(i - period + 1, i + 1));
            rawKs.push((closes[i] - l) / (h - l || 1) * 100);
        }

        const smoothKs = [];
        for (let i = 0; i < rawKs.length; i++) {
            if (i < kSmooth - 1) { smoothKs.push(rawKs[i]); continue; }
            let s = 0;
            for (let j = 0; j < kSmooth; j++) s += rawKs[i - j];
            smoothKs.push(s / kSmooth);
        }

        const k = smoothKs[smoothKs.length - 1];
        let s = 0;
        for (let j = 0; j < dSmooth; j++) s += smoothKs[smoothKs.length - 1 - j] || 0;
        const d = s / dSmooth;
        return { k, d };
    }

    static cci(highs, lows, closes, len) {
        if (closes.length < len) return 0;
        const tp = (i) => (highs[i] + lows[i] + closes[i]) / 3;
        const tps = [];
        for (let i = Math.max(0, closes.length - len * 2); i < closes.length; i++) {
            tps.push(tp(i));
        }
        const currentTp = tps[tps.length - 1];
        let sum = 0;
        for (let i = 0; i < len; i++) sum += tps[tps.length - 1 - i];
        const smaTp = sum / len;

        let md = 0;
        for (let i = 0; i < len; i++) md += Math.abs(tps[tps.length - 1 - i] - smaTp);
        md /= len;

        return (currentTp - smaTp) / (0.015 * md || 1);
    }

    static adx(highs, lows, closes, len) {
        if (closes.length < len * 2) return { adx: 0, pdi: 0, mdi: 0 };
        let tr = [], pdm = [], mdm = [];

        const smooth = (src) => {
             let val = src.slice(0, len).reduce((a,b)=>a+b, 0);
             const res = [val];
             for(let i = len; i < src.length; i++) {
                 val = val - (val/len) + src[i];
                 res.push(val);
             }
             return res;
        };

        const start = Math.max(1, closes.length - len * 5);

        for(let i=start; i<closes.length; i++) {
            const h = highs[i], l = lows[i], pc = closes[i-1];
            tr.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
            const up = h - highs[i-1];
            const down = lows[i-1] - l;
            pdm.push(up > down && up > 0 ? up : 0);
            mdm.push(down > up && down > 0 ? down : 0);
        }

        const str = smooth(tr);
        const spdm = smooth(pdm);
        const smdm = smooth(mdm);

        const dx = [];
        for(let i=0; i<str.length; i++) {
            const pdi = 100 * spdm[i] / (str[i] || 1);
            const mdi = 100 * smdm[i] / (str[i] || 1);
            const val = Math.abs(pdi - mdi) / (pdi + mdi || 1) * 100;
            dx.push(val || 0);
        }

        let adxVal = dx.slice(0, len).reduce((a,b)=>a+b, 0) / len;
        for(let i=len; i<dx.length; i++) {
            adxVal = (adxVal * (len - 1) + dx[i]) / len;
        }

        const lastIdx = str.length - 1;
        return {
            adx: adxVal,
            pdi: 100 * spdm[lastIdx] / (str[lastIdx] || 1),
            mdi: 100 * smdm[lastIdx] / (str[lastIdx] || 1)
        };
    }

    static ao(highs, lows) {
        if (highs.length < 34) return 0;
        const mp = highs.map((h, i) => (h + lows[i]) / 2);
        const sma5 = this.sma(mp, 5);
        const sma34 = this.sma(mp, 34);
        return sma5 - sma34;
    }

    static mom(closes, len) {
        if (closes.length < len) return 0;
        return closes[closes.length - 1] - closes[closes.length - 1 - len];
    }

    static macd(closes, fast, slow, sig) {
        const ema = (data, p) => {
            const k = 2 / (p + 1);
            let e = data[0];
            const res = [e];
            for (let i = 1; i < data.length; i++) {
                e = data[i] * k + e * (1 - k);
                res.push(e);
            }
            return res;
        }
        const f = ema(closes, fast);
        const s = ema(closes, slow);
        const m = f.map((v, i) => v - s[i]);
        const sign = ema(m, sig);
        const lastM = m[m.length - 1];
        const lastS = sign[sign.length - 1];
        return { macd: lastM, signal: lastS, hist: lastM - lastS };
    }

    static stochRsi(closes, len, stochLen, k, d) {
        const start = Math.max(0, closes.length - 200);
        const subset = closes.slice(start);
        const rsis = [];
        let gains = 0, losses = 0;
        for (let i = 1; i <= len; i++) {
            const diff = subset[i] - subset[i - 1];
            if (diff > 0) gains += diff; else losses -= diff;
        }
        let avgGain = gains / len, avgLoss = losses / len;
        rsis.push(100 - 100 / (1 + avgGain / avgLoss));

        for (let i = len + 1; i < subset.length; i++) {
            const diff = subset[i] - subset[i - 1];
            if (diff > 0) {
                avgGain = (avgGain * (len - 1) + diff) / len;
                avgLoss = (avgLoss * (len - 1)) / len;
            } else {
                avgGain = (avgGain * (len - 1)) / len;
                avgLoss = (avgLoss * (len - 1) - diff) / len;
            }
            rsis.push(100 - 100 / (1 + avgGain / avgLoss));
        }

        const rawKs = [];
        for(let i=0; i<rsis.length; i++) {
            if(i < stochLen - 1) { rawKs.push(50); continue; }
            const slice = rsis.slice(i - stochLen + 1, i + 1);
            const h = Math.max(...slice);
            const l = Math.min(...slice);
            rawKs.push((rsis[i] - l) / (h - l || 1) * 100);
        }

        const smoothKs = [];
        for(let i=0; i<rawKs.length; i++) {
            if (i < k - 1) { smoothKs.push(rawKs[i]); continue; }
            let s = 0; for(let j=0; j<k; j++) s += rawKs[i-j];
            smoothKs.push(s/k);
        }

        return { k: smoothKs[smoothKs.length - 1] };
    }

    static wpr(highs, lows, closes, len) {
        if (closes.length < len) return -50;
        const idx = closes.length - 1;
        const h = Math.max(...highs.slice(idx - len + 1, idx + 1));
        const l = Math.min(...lows.slice(idx - len + 1, idx + 1));
        return (h - closes[idx]) / (h - l || 1) * -100;
    }

    static bbp(highs, lows, closes, len) {
        const ema = this.ema(closes, len);
        const idx = closes.length - 1;
        return highs[idx] - ema + (lows[idx] - ema);
    }

    static uo(highs, lows, closes, p1, p2, p3) {
        const start = Math.max(1, closes.length - p3 - 50);
        let bps = [], trs = [];
        for(let i=start; i<closes.length; i++) {
            const c = closes[i], pc = closes[i-1], l = lows[i], h = highs[i];
            bps.push(c - Math.min(l, pc));
            trs.push(Math.max(h, pc) - Math.min(l, pc));
        }

        const sum = (arr, p) => {
            let s = 0;
            for(let i=0; i<p; i++) s += arr[arr.length - 1 - i];
            return s;
        }

        const a1 = sum(bps, p1) / sum(trs, p1);
        const a2 = sum(bps, p2) / sum(trs, p2);
        const a3 = sum(bps, p3) / sum(trs, p3);

        return 100 * (4 * a1 + 2 * a2 + a3) / 7;
    }
}
