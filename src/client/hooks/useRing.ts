import { useState, useEffect, useCallback } from 'react';

interface UseRingOptions {
  url: string;
  name: string;
}

/**
 * Hook for connecting to a Real Steel ring.
 * Manages WebSocket connection with automatic reconnection and participant tracking.
 */
export function useRing({ url, name }: UseRingOptions) {
  const [messages, setMessages] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState(0);
  
  // Refs for WebSocket and reconnection logic
  let wsRef: WebSocket | null = null;
  let reconnectAttemptsRef: number = 0;

  useEffect(() => {
    // Reset state when URL or name changes (new ring connection)
    setMessages([]);
    reconnectAttemptsRef = 0;
    __destroyed = false;

    function connect() {
      try {
        wsRef = new WebSocket(url); 

        if (!wsRef) return;

        // Capture wsRef in closure to satisfy TypeScript's null check requirement
        const currentWsRef = wsRef;
        
        const onopen: () => void = () => {
          console.log(`[useRing] Connected to ${url}`);
          setConnected(true);
          reconnectAttemptsRef = 0;
          
          // Send join message (if needed by server)
          const joinMsg = JSON.stringify({
            type: 'join_request',
            name,
            noClaude: false,
            daemonUrl: undefined,
          });
          currentWsRef.send(joinMsg);
        };

        const onmessage: (event: MessageEvent) => void = (event) => {
          if (__destroyed) return;
          
          const msgStr = event.data.toString();
          
          // Parse message using shared protocol parser
          let msg: any;
          try {
            msg = typeof msgStr === 'object' ? msgStr : JSON.parse(msgStr);
            
            if (!msg || !msg.type || !msg.from) {
              return;
            }

            setMessages((prev) => [...(prev as any[]), msg]);
          } catch (err: any) {
            console.error('[useRing] Failed to parse message:', err.message);
          }
        };

        const onclose: () => void = () => {
          if (__destroyed) return;
          
          console.log(`[useRing] Disconnected from ${url}`);
          setConnected(false);
          
          // Don't reconnect if we're closing cleanly
          const wasCleanClose = (currentWsRef as any).wasClean === true;
          if (!__destroyed && !wasCleanClose) {
            // Reconnect with exponential backoff (max 30 seconds)
            const delay = Math.min(1000 * 2 ** reconnectAttemptsRef, 30000);
            reconnectAttemptsRef++;
            
            setTimeout(() => connect(), delay);
          } else {
            console.log('[useRing] Clean disconnect, not reconnecting');
          }
        };

        const onerror: (err: any) => void = (err) => {
          if (__destroyed) return;
          console.error('[useRing] WebSocket error:', err.message);
          // Errors trigger close event, which handles reconnection
        };

        wsRef.onopen = onopen;
        wsRef.onmessage = onmessage;
        wsRef.onclose = onclose;
        wsRef.onerror = onerror;
      } catch (err: any) {
        console.error('[useRing] Failed to create WebSocket:', err.message);
      }
    }

    connect();

    return () => {
      __destroyed = true;
      if (wsRef && wsRef.readyState === WebSocket.OPEN) {
        wsRef.close();
      }
    };
  }, [url, name]);

  const sendMessage = useCallback((content: string) => {
    // Don't send if not connected or destroyed
    if (!connected || __destroyed) return false;
    
    // Check WebSocket readyState (1 = OPEN)
    let currentWsRef = wsRef;
    if (!currentWsRef || currentWsRef.readyState !== WebSocket.OPEN) {
      console.log('[useRing] Not connected, cannot send message');
      return false;
    }

    let seqNum: number = 0;
    const seq = ++seqNum;
    const msg: any = {
      type: 'message',
      from: name,
      role: 'human',
      content: content.trim(),
      seq: seq,
      id: `msg-${Date.now()}-${seq}`,
      timestamp: new Date().toISOString(),
    };

    try {
      currentWsRef.send(JSON.stringify(msg));
      setMessages((prev) => [...(prev as any[]), msg]);
      
      console.log(`[useRing] Message sent: "${content.trim().substring(0, 50)}..."`);
      return true;
    } catch (err: any) {
      console.error('[useRing] Failed to send message:', err.message);
      return false;
    }
  }, [name, connected]);

  // Track participant count from system events
  useEffect(() => {
    let currentWsRef = wsRef;
    if (!currentWsRef || currentWsRef.readyState !== WebSocket.OPEN) return;

    const handleSystemEvent = (data: any) => {
      try {
        const msg = data as any;
        
        if (msg?.type === 'system' && msg.content) {
          // Parse join events: "Name has joined the ring"
          if (msg.content.includes('joined')) {
            setParticipants(prev => prev + 1);
          }
          // Parse leave events: "Name has left the ring"  
          else if (msg.content.includes('left')) {
            setParticipants(prev => Math.max(0, prev - 1));
          }
        }
      } catch {}
    };

    const onmessageHandler = (event: MessageEvent) => {
      // Check for system event before normal message handling
      try {
        handleSystemEvent(event.data as any);
      } catch {}
      
      // Then process as normal message if not destroyed
      if (!__destroyed) {
        setMessages((prev) => [...(prev as any[]), (event.data as any) || null]);
      }
    };

    // Use type assertion to bypass TypeScript's null check issue in effect cleanup
    const wsOnmessage: any = currentWsRef.onmessage;
    currentWsRef.onmessage = onmessageHandler;

    return () => {
      wsOnmessage ? (currentWsRef.onmessage = wsOnmessage) : (currentWsRef.onmessage = null);
    };
  }, [wsRef, __destroyed]);

  // Use ref for destroyed flag to avoid stale closures
  const setDestroyed = useCallback((val: boolean) => {
    (__destroyed as any) = val;
  }, []);

  return { 
    messages, 
    participants: Math.max(0, participants), 
    connected, 
    sendMessage,
    __destroyed: false as any // Placeholder - will be set by cleanup function
  };
}
