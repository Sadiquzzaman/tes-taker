"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getProctoringSocketUrl } from "@/utils/tests/proctoringSocket";

const storedToken = () => {
  try {
    return (JSON.parse(localStorage.getItem("user") ?? "null") as { access_token?: string } | null)?.access_token ?? null;
  } catch {
    return null;
  }
};

/**
 * The chat socket (P9-01, COM-03): namespace `/chat` on the API's origin. The server puts the
 * socket in the person's group rooms; `subscribe()` asks again after the list made new groups.
 * Every event goes to `onEvent` (the latest one passed).
 */
const useChatSocket = (onEvent: (event: ChatSocketEvent) => void, enabled = true) => {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const origin = getProctoringSocketUrl(process.env.NEXT_PUBLIC_SOCKET_URL, process.env.NEXT_PUBLIC_BASE_URL);
    const token = storedToken();
    if (!enabled || !origin || !token) return;
    const socket = io(`${origin}/chat`, { autoConnect: false, auth: { token }, transports: ["websocket", "polling"], withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("chat:message", (message: ChatMessage) => handler.current({ type: "message", message }));
    socket.on("chat:deleted", (e: { group_id: string; id: string; parent_id: string | null }) => handler.current({ type: "deleted", ...e }));
    socket.on("chat:read", (e: { chat_id: string; user_id: string; at: string }) => handler.current({ type: "read", ...e }));
    socket.on("chat:group", (e: { group_id: string; pinned_ids: string[]; announcement_only: boolean }) => handler.current({ type: "group", ...e }));
    socket.connect();
    return () => {
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [enabled]);

  return { connected, subscribe: () => socketRef.current?.emit("chat:subscribe") };
};

export default useChatSocket;
