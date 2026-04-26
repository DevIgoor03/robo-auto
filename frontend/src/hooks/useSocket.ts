import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStore } from '../services/api';

const SERVER_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Eventos em tempo real da API (Socket.IO)
const SOCKET_EVENTS = [
  'connect', 'disconnect', 'connect_error',
  // Master
  'master:balance',
  // Followers
  'follower:updated', 'follower:removed', 'follower:stopped',
  // Copy control
  'copy:started', 'copy:stopped', 'copy:error',
  // Robô automático
  'robot:started', 'robot:stopped', 'robot:profit',
  // Trades
  'trade:new', 'trade:updated',
] as const;

export function useSocket(
  onEvent: (event: string, data: any) => void,
  accessToken?: string
) {
  const socketRef = useRef<Socket | null>(null);
  const cbRef     = useRef(onEvent);
  cbRef.current   = onEvent;

  const token = accessToken ?? tokenStore.getAccess();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(SERVER_URL, {
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 1000,
      auth:              { token },
    });

    SOCKET_EVENTS.forEach((ev) => {
      socket.on(ev, (d: any) => cbRef.current(ev, d));
    });

    socketRef.current = socket;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    connect();
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [token, connect]);

  return { socket: socketRef.current, connect };
}
