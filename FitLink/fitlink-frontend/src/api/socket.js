// s@/api/socket.js
import { io } from "socket.io-client";
import { backendUrl } from '@/utils/backendUrl';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(backendUrl(import.meta.env.VITE_SOCKET_URL) || undefined, {
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}
