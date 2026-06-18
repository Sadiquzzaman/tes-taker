import useReportStudentExamViolation from "@/hooks/api/exam/useReportStudentExamViolation";
import { getPersistedViolationType, getSocketFlagType } from "@/utils/tests/proctoringEventMap";
import { getProctoringSocketUrl } from "@/utils/tests/proctoringSocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const useProctoringSocket = ({
  answerSheet,
  examId,
  flags,
  isEnabled,
  totalFlagPoints,
}: UseProctoringSocketOptions): UseProctoringSocketResult => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reportViolation = useReportStudentExamViolation();
  const socketRef = useRef<Socket | null>(null);
  const hasSentSubmitRef = useRef(false);
  const sentFlagIdsRef = useRef(new Set<string>());
  const reportedViolationIdsRef = useRef(new Set<string>());
  const socketUrl = getProctoringSocketUrl(process.env.NEXT_PUBLIC_SOCKET_URL, process.env.NEXT_PUBLIC_BASE_URL);

  const getStoredUser = () => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as User;
    } catch {
      return null;
    }
  };

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setIsSessionReady(false);
  }, []);

  const emitExamJoin = useCallback(
    (nextSocket: Socket) => {
      if (!examId) {
        return;
      }

      nextSocket.emit("exam:join", {
        examId,
        role: "student",
      });
    },
    [examId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      sentFlagIdsRef.current = new Set();
      reportedViolationIdsRef.current = new Set();
      hasSentSubmitRef.current = false;
      setIsSessionReady(false);
      setConnectionError(null);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      disconnectSocket();
    };
  }, [disconnectSocket, examId]);

  useEffect(() => {
    if (!socket || !socket.connected || !isSessionReady || !examId) {
      return;
    }

    const unsentFlags = flags.filter((flag) => !sentFlagIdsRef.current.has(flag.id));

    if (!unsentFlags.length) {
      return;
    }

    unsentFlags.forEach((flag) => {
      const socketFlagType = getSocketFlagType(flag.type);
      sentFlagIdsRef.current.add(flag.id);

      socket.emit("flag:report", {
        examId,
        type: socketFlagType,
        message: flag.message,
        points: flag.points,
      });

      const violationType = getPersistedViolationType(flag.type);
      if (!violationType || reportedViolationIdsRef.current.has(flag.id)) {
        return;
      }

      reportedViolationIdsRef.current.add(flag.id);
      void reportViolation({
        examId,
        violationType,
      });
    });
  }, [examId, flags, isSessionReady, reportViolation, socket]);

  const connectToSocket = useCallback(() => {
    if (!isEnabled || !examId || !socketUrl) {
      return;
    }

    const storedUser = getStoredUser();

    if (!storedUser?.access_token) {
      setConnectionError("Authentication required.");
      return;
    }

    if (socketRef.current?.connected) {
      emitExamJoin(socketRef.current);
      return;
    }

    disconnectSocket();

    const nextSocket = io(socketUrl, {
      autoConnect: false,
      auth: {
        token: storedUser.access_token,
      },
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    nextSocket.on("connect", () => {
      setConnectionError(null);
      setIsSessionReady(false);
      emitExamJoin(nextSocket);
    });

    nextSocket.on("session:ready", () => {
      setConnectionError(null);
      setIsSessionReady(true);
    });

    nextSocket.on("exam:error", (error: { message?: string }) => {
      setConnectionError(error.message ?? "Unable to join the proctoring session.");
      setIsSessionReady(false);
    });

    nextSocket.on("connect_error", (error) => {
      setConnectionError(error.message);
      setIsSessionReady(false);
    });

    nextSocket.on("disconnect", () => {
      setIsSessionReady(false);
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);
    nextSocket.connect();
  }, [disconnectSocket, emitExamJoin, examId, isEnabled, socketUrl]);

  const emitExamSubmit = useCallback(() => {
    const currentSocket = socketRef.current;

    if (!currentSocket?.connected || !examId || hasSentSubmitRef.current) {
      return;
    }

    const storedUser = getStoredUser();

    if (!storedUser) {
      return;
    }

    currentSocket.emit("exam:submit", {
      examId,
      studentId: storedUser.id,
      studentName: storedUser.full_name,
      answers: answerSheet,
      totalFlagPoints,
    });
    hasSentSubmitRef.current = true;
  }, [answerSheet, examId, totalFlagPoints]);

  return {
    connectToSocket,
    emitExamSubmit,
    isSessionReady,
    connectionError,
  };
};

export default useProctoringSocket;
