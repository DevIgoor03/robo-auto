import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { portalTokenStore } from '../services/portalApi.js';

const SERVER_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Socket.IO para o portal do seguidor (auth via `x-portal-token` → handshake `portalToken`).
 * Recebe `trade:new` e `trade:updated` em tempo real.
 */
export function usePortalSocket(
  enabled: boolean,
  onTradeNew: (data: unknown) => void,
  onTradeUpdated: (data: unknown) => void,
) {
  const newRef = useRef(onTradeNew);
  const updRef = useRef(onTradeUpdated);
  newRef.current = onTradeNew;
  updRef.current = onTradeUpdated;

  useEffect(() => {
    if (!enabled) return;
    const token = portalTokenStore.get();
    if (!token) return;

    const socket: Socket = io(SERVER_URL, {
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 1000,
      auth:              { portalToken: token },
    });

    socket.on('trade:new', (d: unknown) => newRef.current(d));
    socket.on('trade:updated', (d: unknown) => updRef.current(d));

    return () => {
      socket.disconnect();
    };
  }, [enabled]);
}
