import html2canvas from "html2canvas";
import type { FeedbackSource } from "@qelp/shared/contracts";

interface WidgetConfig {
  apiBaseUrl: string;
  workspaceId: string;
  projectId: string;
  projectKey: string;
  themeColor?: string;
}

interface PreparedAttachment {
  id: string;
  type: "image" | "audio";
  mimeType: string;
  size: number;
}

interface FeedbackPayload {
  workspaceId: string;
  projectId: string;
  source: FeedbackSource;
  reporter: { email?: string; name?: string };
  content: { message: string; stepsToReproduce: string[] };
  attachments: { id: string }[];
  environment: {
    url: string;
    route?: string;
    browser: string;
    os: string;
    locale: string;
    userAgent: string;
    viewport: { width: number; height: number };
  };
  voiceTranscript: null;
}

declare global {
  interface Window {
    QelpWidget?: {
      init: (config: WidgetConfig) => void;
      open: () => void;
    };
  }
}

const LAUNCHER_ID = "qelp-widget-launcher";
const SHEET_ID = "qelp-widget-sheet";
const HIDDEN_ATTR = "data-html2canvas-ignore";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR_RE.test(value) ? value : fallback;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (key === "style") node.setAttribute("style", value);
    else node.setAttribute(key, value);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

class QelpWidget {
  private config: WidgetConfig | null = null;
  private mounted = false;
  private screenshot: PreparedAttachment | null = null;
  private audio: PreparedAttachment | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartedAt = 0;

  private statusEl: HTMLElement | null = null;
  private screenshotPreview: HTMLElement | null = null;
  private audioPreview: HTMLElement | null = null;
  private recordButton: HTMLButtonElement | null = null;

  init(config: WidgetConfig) {
    this.config = config;
    if (!this.mounted) {
      this.mount();
      this.mounted = true;
    }
  }

  open() {
    document.getElementById(SHEET_ID)?.classList.add("qelp-open");
  }

  private close() {
    document.getElementById(SHEET_ID)?.classList.remove("qelp-open");
  }

  private mount() {
    const themeColor = sanitizeColor(this.config?.themeColor, "#0f766e");

    const launcher = el("button", {
      id: LAUNCHER_ID,
      [HIDDEN_ATTR]: "true",
      style: `position:fixed;right:24px;bottom:24px;z-index:2147483647;border:none;border-radius:999px;padding:12px 16px;background:${themeColor};color:white;font-weight:700;box-shadow:0 12px 32px rgba(0,0,0,0.22);cursor:pointer;font-family:system-ui,sans-serif;`,
    }, "Send feedback");
    launcher.addEventListener("click", () => this.open());

    const overlay = el("div", {
      "data-overlay": "true",
      style: "position:fixed;inset:0;display:none;background:rgba(15,23,42,0.3);",
    });

    const panel = el("div", {
      style: "position:absolute;right:24px;bottom:92px;width:min(440px, calc(100vw - 32px));background:#fff;border-radius:20px;padding:20px;box-shadow:0 18px 40px rgba(0,0,0,0.22);font-family:system-ui,sans-serif;max-height:calc(100vh - 120px);overflow-y:auto;",
    });

    // header
    const header = el("div", {
      style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;",
    });
    header.append(el("strong", { style: "font-size:18px;" }, "Tell us what happened"));
    const closeButton = el("button", {
      type: "button",
      "data-close": "true",
      style: "border:none;background:transparent;font-size:20px;cursor:pointer;",
    }, "×");
    closeButton.addEventListener("click", () => this.close());
    header.append(closeButton);

    // form fields
    const emailLabel = el("label", { style: "display:block;margin-bottom:6px;font-size:13px;" }, "Email");
    const emailInput = el("input", {
      "data-email": "true",
      type: "email",
      style: "width:100%;margin-bottom:12px;padding:10px;border:1px solid #d0d5dd;border-radius:12px;",
    });

    const messageLabel = el("label", { style: "display:block;margin-bottom:6px;font-size:13px;" }, "Describe the issue");
    const messageInput = el("textarea", {
      "data-message": "true",
      rows: "4",
      style: "width:100%;margin-bottom:12px;padding:10px;border:1px solid #d0d5dd;border-radius:12px;",
    }) as HTMLTextAreaElement;

    // capture buttons
    const buttonRow = el("div", {
      style: "display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;",
    });
    const screenshotButton = el("button", {
      type: "button",
      style: "background:transparent;border:1px solid #d0d5dd;padding:8px 12px;border-radius:999px;cursor:pointer;",
    }, "Capture screenshot");
    screenshotButton.addEventListener("click", () => void this.captureScreenshot());

    const recordButton = el("button", {
      type: "button",
      style: "background:transparent;border:1px solid #d0d5dd;padding:8px 12px;border-radius:999px;cursor:pointer;",
    }, "Record voice");
    recordButton.addEventListener("click", () => void this.toggleRecording());
    this.recordButton = recordButton;

    buttonRow.append(screenshotButton, recordButton);

    const screenshotPreview = el("div", { style: "margin-bottom:12px;" });
    const audioPreview = el("div", { style: "margin-bottom:12px;" });

    // submit
    const submitButton = el("button", {
      type: "button",
      style: `width:100%;border:none;border-radius:999px;padding:12px 16px;background:${themeColor};color:#fff;font-weight:700;cursor:pointer;`,
    }, "Submit feedback");
    submitButton.addEventListener("click", () => void this.submit());

    const status = el("p", { style: "margin-top:10px;font-size:13px;color:#475467;" });

    this.statusEl = status;
    this.screenshotPreview = screenshotPreview;
    this.audioPreview = audioPreview;

    panel.append(
      header,
      emailLabel,
      emailInput,
      messageLabel,
      messageInput,
      buttonRow,
      screenshotPreview,
      audioPreview,
      submitButton,
      status,
    );

    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });

    const sheet = el("div", { id: SHEET_ID, [HIDDEN_ATTR]: "true" });
    sheet.append(overlay);

    const style = el("style", { [HIDDEN_ATTR]: "true" });
    style.textContent = `#${SHEET_ID}.qelp-open > div[data-overlay] { display: block !important; }`;

    document.body.append(launcher, sheet, style);
  }

  private setStatus(message: string) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  private getInput<T extends HTMLElement>(selector: string) {
    return document.querySelector<T>(`#${SHEET_ID} ${selector}`);
  }

  private async captureScreenshot() {
    if (!this.config) return;
    this.setStatus("Capturing screenshot...");
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        ignoreElements: (element) => element.hasAttribute(HIDDEN_ATTR),
        backgroundColor: null,
        logging: false,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), "image/png"),
      );
      if (!blob) throw new Error("Could not encode screenshot");

      const attachment = await this.uploadBlob(blob, "screenshot.png");
      this.screenshot = attachment;

      if (this.screenshotPreview) {
        this.screenshotPreview.replaceChildren();
        const img = el("img", {
          src: URL.createObjectURL(blob),
          alt: "Screenshot preview",
          style: "max-width:100%;border-radius:12px;border:1px solid #d0d5dd;",
        });
        this.screenshotPreview.append(img);
      }

      this.setStatus("Screenshot attached.");
    } catch (error) {
      this.setStatus("Screenshot capture failed.");
      console.warn("[Qelp] screenshot failed", error);
    }
  }

  private async toggleRecording() {
    if (!this.config) return;
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
      this.setStatus("Stopping recording...");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      this.recordedChunks = [];
      this.recordingStartedAt = performance.now();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        const durationMs = performance.now() - this.recordingStartedAt;
        const blob = new Blob(this.recordedChunks, { type: "audio/webm" });
        void this.afterRecording(blob, durationMs / 1000);
      });

      this.mediaRecorder = recorder;
      recorder.start();
      if (this.recordButton) this.recordButton.textContent = "Stop recording";
      this.setStatus("Recording...");
    } catch (error) {
      this.setStatus("Microphone access denied.");
      console.warn("[Qelp] recording failed", error);
    }
  }

  private async afterRecording(blob: Blob, _durationSeconds: number) {
    if (this.recordButton) this.recordButton.textContent = "Record voice";

    try {
      const attachment = await this.uploadBlob(blob, "voice.webm");
      this.audio = attachment;

      if (this.audioPreview) {
        this.audioPreview.replaceChildren();
        const audio = el("audio", {
          controls: "true",
          src: URL.createObjectURL(blob),
          style: "width:100%;",
        });
        this.audioPreview.append(audio);
      }

      this.setStatus("Voice note attached.");
    } catch (error) {
      this.setStatus("Voice upload failed.");
      console.warn("[Qelp] voice upload failed", error);
    }
  }

  private async uploadBlob(blob: Blob, filename: string): Promise<PreparedAttachment> {
    if (!this.config) throw new Error("Widget not initialized");

    const form = new FormData();
    form.append("file", blob, filename);
    form.append("workspaceId", this.config.workspaceId);
    form.append("projectId", this.config.projectId);

    const response = await fetch(`${this.config.apiBaseUrl}/uploads`, {
      method: "POST",
      headers: { "x-qelp-project-key": this.config.projectKey },
      body: form,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    return (await response.json()) as PreparedAttachment;
  }

  private async submit() {
    if (!this.config) return;

    const emailInput = this.getInput<HTMLInputElement>("[data-email]");
    const messageInput = this.getInput<HTMLTextAreaElement>("[data-message]");
    const email = emailInput?.value.trim() ?? "";
    const message = messageInput?.value.trim() ?? "";

    if (message.length < 10) {
      this.setStatus("Please describe the issue (at least 10 characters).");
      return;
    }

    this.setStatus("Submitting...");

    const attachments = [
      ...(this.screenshot ? [{ id: this.screenshot.id }] : []),
      ...(this.audio ? [{ id: this.audio.id }] : []),
    ];

    const payload: FeedbackPayload = {
      workspaceId: this.config.workspaceId,
      projectId: this.config.projectId,
      source: "widget",
      reporter: email ? { email } : {},
      content: { message, stepsToReproduce: [] },
      attachments,
      environment: captureEnvironment(),
      voiceTranscript: null,
    };

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-qelp-project-key": this.config.projectKey,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Submit failed: ${response.status}`);
      this.setStatus("Feedback submitted. Thanks!");
      this.screenshot = null;
      this.audio = null;
    } catch (error) {
      this.setStatus("Submission failed. Please try again.");
      console.warn("[Qelp] submit failed", error);
    }
  }
}

function captureEnvironment() {
  return {
    url: window.location.href,
    route: window.location.pathname,
    browser: detectBrowser(navigator.userAgent),
    os: detectOS(navigator.userAgent),
    locale: navigator.language,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

function detectBrowser(userAgent: string) {
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Firefox")) return "Firefox";
  return "Unknown";
}

function detectOS(userAgent: string) {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  return "Unknown";
}

const widget = new QelpWidget();
window.QelpWidget = {
  init: (config) => widget.init(config),
  open: () => widget.open(),
};
