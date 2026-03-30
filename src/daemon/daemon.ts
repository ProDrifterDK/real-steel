import { Listener } from "./listener.js";
import { Debouncer } from "./debouncer.js";
import { ClaudeBridge } from "./bridge.js";
import {
  createChatMessage,
  type RingMessage,
} from "../shared/protocol.js";
import type { DaemonConfig } from "../shared/config.js";
import {
  generatePrivacyPrompt,
  generateToolRestrictions,
} from "../privacy/filter.js";

/**
 * Orquestador del daemon.
 * Conecta: Listener → Debouncer → Bridge → Ring
 */
export class Daemon {
  private listener: Listener;
  private debouncer: Debouncer;
  private bridge: ClaudeBridge;
  private pendingMessages: RingMessage[] = [];
  private url: string;
  private name: string;
  private seq = 0;

  constructor(url: string, name: string, config: DaemonConfig) {
    this.url = url;
    this.name = name;

    // Generar system prompt con privacy config
    const privacyPrompt = generatePrivacyPrompt(config.privacy);
    const toolRestrictions = generateToolRestrictions(config.privacy);

    const systemPrompt =
      `You are in a Real Steel ring - a group chat with other humans and AI agents. ` +
      `You are the agent of ${name}. You participate as an equal. ` +
      `Don't respond to every message - only when you have something genuinely useful to contribute. ` +
      `You have access to the local files and projects of ${name}. ` +
      `When you have nothing to add, respond with exactly: [SILENT]\n\n` +
      `${privacyPrompt}`;

    // Inicializar bridge con config de privacy
    this.bridge = new ClaudeBridge({
      userName: name,
      maxInvocationsPerMinute: config.maxInvocationsPerMinute,
      systemPrompt,
      permissionMode: "auto",
      toolRestrictions:
        toolRestrictions.type !== "none" ? toolRestrictions : undefined,
    });

    // Inicializar debouncer que dispara handleBatch
    this.debouncer = new Debouncer(config.debounceMs, (messages) =>
      this.handleBatch(messages)
    );

    // Inicializar listener con callbacks
    this.listener = new Listener(url, name, {
      onMessage: (msg) => this.onMessage(msg),
      onConnect: () => console.log(`[daemon] Connected to ring as Claude-${name}`),
      onDisconnect: () => console.log("[daemon] Disconnected from ring"),
      onError: (err) => console.error("[daemon] Error:", err.message),
    });
  }

  /**
   * Inicia el daemon conectando al ring.
   */
  async start(): Promise<void> {
    console.log(`[daemon] Starting for user "${this.name}" at ${this.url}`);
    this.listener.connect();
  }

  /**
   * Detiene el daemon esperando invocaciones en progreso.
   */
  async stop(): Promise<void> {
    console.log("[daemon] Stopping...");

    // Destruir debouncer (limpia buffer y timer)
    this.debouncer.destroy();

    // Esperar cualquier invocación de Claude en progreso
    if (this.bridge.isBusy()) {
      console.log("[daemon] Waiting for Claude invocation to finish...");
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!this.bridge.isBusy()) {
            clearInterval(interval);
            resolve();
          }
        }, 200);
      });
    }

    // Destruir listener (cierra WebSocket)
    this.listener.destroy();
    console.log("[daemon] Stopped.");
  }

  /**
   * Callback cuando listener recibe un mensaje.
   * Ignora propios mensajes y pasa al debouncer o pending buffer.
   */
  private onMessage(msg: RingMessage): void {
    // Ignorar propios mensajes (evita eco)
    if (msg.type === "message" && msg.from === `Claude-${this.name}`) {
      return;
    }

    console.log(`[daemon] Received message from ${msg.type === "system" ? "system" : msg.from}`);

    // Si Claude está busy, acumular en pending buffer
    if (this.bridge.isBusy()) {
      this.pendingMessages.push(msg);
      console.log(`[daemon] Message queued (Claude busy), pending: ${this.pendingMessages.length}`);
    } else {
      // De lo contrario, pasar al debouncer
      this.debouncer.push(msg);
    }
  }

  /**
   * Callback del debouncer cuando hay un batch de mensajes.
   * Invoca Claude, envía respuesta al ring, procesa pending messages.
   */
  private async handleBatch(messages: RingMessage[]): Promise<void> {
    console.log(`[daemon] Debouncer fired with ${messages.length} message(s)`);

    // Si Claude está busy (raro pero posible), acumular en pending
    if (this.bridge.isBusy()) {
      this.pendingMessages.push(...messages);
      console.log("[daemon] Batch queued (Claude still busy)");
      return;
    }

    // Invocar Claude con el batch
    const response = await this.bridge.invoke(messages);

    if (response) {
      // Crear mensaje de respuesta y enviar al ring
      this.seq++;
      const msg = createChatMessage(
        `Claude-${this.name}`,
        "agent",
        response,
        this.seq
      );
      console.log(`[daemon] Sending response to ring: ${response.substring(0, 80)}...`);
      this.listener.send(JSON.stringify(msg));
    } else {
      console.log("[daemon] Claude did not respond (silent or rate-limited)");
    }

    // Procesar mensajes que llegaron mientras Claude estaba busy
    if (this.pendingMessages.length > 0) {
      const pending = [...this.pendingMessages];
      this.pendingMessages = [];
      console.log(`[daemon] Processing ${pending.length} pending message(s)`);
      for (const msg of pending) {
        this.debouncer.push(msg);
      }
    }
  }
}
