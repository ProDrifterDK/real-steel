import { useState, useEffect, useCallback, useRef } from "react";
import WebSocket from "ws";
import {
  parseMessage,
  createChatMessage,
  type RingMessage,
} from "../../shared/protocol.js";

interface UseRingOptions {
  url: string;
  name: string;
}

interface UseRingResult {
  messages: RingMessage[];
  participants: number;
  connected: boolean;
  sendMessage: (content: string) => void;
}

export function useRing({ url, name }: UseRingOptions): UseRingResult {
  const [messages, setMessages] = useState<RingMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [participantNames, setParticipantNames] = useState<Set<string>>(
    new Set()
  );
  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const destroyedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    destroyedRef.current = false;

    function connect() {
      const ws = new WebSocket(url, {
        headers: { "x-participant-name": name },
      });
      wsRef.current = ws;

      ws.on("open", () => {
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      });

      ws.on("message", (data: Buffer) => {
        const msg = parseMessage(data.toString());
        if (msg) {
          setMessages((prev) => [...prev, msg]);

          if (msg.type === "system") {
            const joinMatch = msg.content.match(/^(.+) has joined the ring$/);
            const leaveMatch = msg.content.match(/^(.+) has left the ring$/);
            if (joinMatch) {
              setParticipantNames((prev) => new Set([...prev, joinMatch[1]]));
            } else if (leaveMatch) {
              setParticipantNames((prev) => {
                const next = new Set(prev);
                next.delete(leaveMatch[1]);
                return next;
              });
            }
          }
        }
      });

      ws.on("close", () => {
        setConnected(false);
        if (!destroyedRef.current) {
          const delay = Math.min(
            1000 * 2 ** reconnectAttemptsRef.current,
            30000
          );
          reconnectAttemptsRef.current++;
          setTimeout(() => {
            if (!destroyedRef.current) connect();
          }, delay);
        }
      });

      ws.on("error", () => {
        // Errors trigger close event, which handles reconnection
      });
    }

    connect();
    setParticipantNames(new Set([name]));

    return () => {
      destroyedRef.current = true;
      wsRef.current?.close();
    };
  }, [url, name]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        seqRef.current++;
        const msg = createChatMessage(
          name,
          "human",
          content,
          seqRef.current
        );
        wsRef.current.send(JSON.stringify(msg));
        setMessages((prev) => [...prev, msg]);
      }
    },
    [name]
  );

  return {
    messages,
    participants: participantNames.size,
    connected,
    sendMessage,
  };
}
