import { ClientSdk, TurboOptionsDirection } from '@quadcode-tech/client-sdk-js';
import { logger } from '../utils/logger.js';

/** Tamanho da vela em segundos — M1. */
export const TURBO_M1_CANDLE_SIZE_SEC = 60;

function rsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0;
  let losses = 0;
  const start = closes.length - 14;
  for (let i = start; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function sma(values: number[], len: number): number {
  const slice = values.slice(-len);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Direção sugerida para turbo M1: RSI(14), SMA5 vs SMA15, última vela.
 */
export async function decideTurboM1Direction(
  sdk: ClientSdk,
  activeId: number,
): Promise<{ direction: TurboOptionsDirection; rationale: string }> {
  try {
    const candlesFacade = await sdk.candles();
    const candles = await candlesFacade.getCandles(activeId, TURBO_M1_CANDLE_SIZE_SEC, {
      count:      45,
      onlyClosed: true,
    });

    if (!candles?.length || candles.length < 18) {
      const direction =
        Math.random() < 0.5 ? TurboOptionsDirection.Call : TurboOptionsDirection.Put;
      return { direction, rationale: 'Poucas velas M1 — sinal fraco' };
    }

    const closes = candles.map((c) => c.close);
    const rsi = rsi14(closes);
    const s5  = sma(closes, 5);
    const s15 = sma(closes, 15);
    const last = candles[candles.length - 1];
    const lastBull = last.close >= last.open;

    let direction: TurboOptionsDirection;
    let rationale: string;

    if (rsi !== null && rsi < 34) {
      direction = TurboOptionsDirection.Call;
      rationale = `RSI ${rsi.toFixed(0)} sobrevenda`;
    } else if (rsi !== null && rsi > 66) {
      direction = TurboOptionsDirection.Put;
      rationale = `RSI ${rsi.toFixed(0)} sobrecompra`;
    } else if (s5 > s15 * 1.00008) {
      direction = TurboOptionsDirection.Call;
      rationale = 'SMA5 > SMA15 (tendência alta)';
    } else if (s5 < s15 * 0.99992) {
      direction = TurboOptionsDirection.Put;
      rationale = 'SMA5 < SMA15 (tendência baixa)';
    } else if (lastBull) {
      direction = TurboOptionsDirection.Call;
      rationale = 'Última vela M1 de alta';
    } else {
      direction = TurboOptionsDirection.Put;
      rationale = 'Última vela M1 de baixa';
    }

    return { direction, rationale };
  } catch (err: any) {
    logger.warn({ err: err?.message, activeId }, 'decideTurboM1Direction: erro');
    const direction =
      Math.random() < 0.5 ? TurboOptionsDirection.Call : TurboOptionsDirection.Put;
    return { direction, rationale: 'Erro nas velas' };
  }
}
