import type { FeedbackSource } from "@qelp/shared/contracts";

interface WidgetConfig {
  apiBaseUrl: string;
  workspaceId: string;
  projectId: string;
  projectKey: string;
  themeColor?: string;
}

interface FeedbackPayload {
  workspaceId: string;
  projectId: string;
  source: FeedbackSource;
  reporter: {
    email?: string;
    name?: string;
  };
  content: {
    message: string;
    stepsToReproduce: string[];
  };
  attachments: Array<{
    id: string;
    type: "image" | "audio";
    url: string;
    mimeType: string;
    createdAt: string;
  }>;
  environment: {
    url: string;
    route?: string;
    browser: string;
    os: string;
    locale: string;
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  voiceTranscript: {
    transcript: string;
    durationSeconds: number;
  } | null;
}

declare global {
  interface Window {
    QelpWidget?: {
      init: (config: WidgetConfig) => void;
      open: () => void;
    };
  }
}

class QelpWidget {
  private config: WidgetConfig | null = null;
  private mounted = false;

  init(config: WidgetConfig) {
    this.config = config;
    if (!this.mounted) {
      this.mount();
      this.mounted = true;
    }
  }

  open() {
    document.getElementById("qelp-widget-sheet")?.classList.add("qelp-open");
  }

  private mount() {
    const launcher = document.createElement("button");
    launcher.id = "qelp-widget-launcher";
    launcher.textContent = "Send feedback";
    launcher.style.cssText = `
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483647;
      border: none;
      border-radius: 999px;
      padding: 12px 16px;
      background: ${this.config?.themeColor ?? "#0f766e"};
      color: white;
      font-weight: 700;
      box-shadow: 0 12px 32px rgba(0,0,0,0.22);
      cursor: pointer;
    `;
    launcher.addEventListener("click", () => this.open());

    const sheet = document.createElement("div");
    sheet.id = "qelp-widget-sheet";
    sheet.innerHTML = `
      <div style="position:fixed; inset:0; display:none; background:rgba(15,23,42,0.3);" data-overlay>
        <div style="position:absolute; right:24px; bottom:92px; width:min(430px, calc(100vw - 32px)); background:#fff; border-radius:20px; padding:20px; box-shadow:0 18px 40px rgba(0,0,0,0.22);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:18px;">Tell us what happened</strong>
            <button type="button" data-close style="border:none; background:transparent; font-size:18px; cursor:pointer;">x</button>
          </div>
          <label style="display:block; margin-bottom:8px;">Email</label>
          <input id="qelp-email" type="email" style="width:100%; margin-bottom:12px; padding:10px; border:1px solid #d0d5dd; border-radius:12px;" />
          <label style="display:block; margin-bottom:8px;">Describe the issue</label>
          <textarea id="qelp-message" rows="5" style="width:100%; margin-bottom:12px; padding:10px; border:1px solid #d0d5dd; border-radius:12px;"></textarea>
          <label style="display:block; margin-bottom:8px;">Voice note summary</label>
          <input id="qelp-voice" type="text" placeholder="Optional transcript or spoken summary" style="width:100%; margin-bottom:12px; padding:10px; border:1px solid #d0d5dd; border-radius:12px;" />
          <button id="qelp-submit" type="button" style="width:100%; border:none; border-radius:999px; padding:12px 16px; background:${this.config?.themeColor ?? "#0f766e"}; color:#fff; font-weight:700; cursor:pointer;">Submit feedback</button>
          <p id="qelp-status" style="margin-top:10px; font-size:13px; color:#475467;"></p>
        </div>
      </div>
    `;

    const overlay = sheet.querySelector("[data-overlay]") as HTMLDivElement;
    const closeButton = sheet.querySelector("[data-close]") as HTMLButtonElement;
    const submitButton = sheet.querySelector("#qelp-submit") as HTMLButtonElement;

    closeButton.addEventListener("click", () => this.close());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });

    submitButton.addEventListener("click", async () => {
      const email = (sheet.querySelector("#qelp-email") as HTMLInputElement).value;
      const message = (sheet.querySelector("#qelp-message") as HTMLTextAreaElement).value;
      const voiceSummary = (sheet.querySelector("#qelp-voice") as HTMLInputElement).value;
      const status = sheet.querySelector("#qelp-status") as HTMLParagraphElement;

      if (!message.trim()) {
        status.textContent = "Please describe the issue before submitting.";
        return;
      }

      status.textContent = "Submitting...";
      try {
        await this.submit({
          workspaceId: this.config?.workspaceId ?? "",
          projectId: this.config?.projectId ?? "",
          source: "widget",
          reporter: { email },
          content: { message, stepsToReproduce: [] },
          attachments: [],
          environment: captureEnvironment(),
          voiceTranscript: voiceSummary.trim() ? { transcript: voiceSummary.trim(), durationSeconds: 8 } : null
        });
        status.textContent = "Feedback submitted.";
      } catch {
        status.textContent = "Submission failed. Check API connectivity.";
      }
    });

    const style = document.createElement("style");
    style.textContent = "#qelp-widget-sheet.qelp-open > div { display:block !important; }";

    document.body.append(launcher, sheet, style);
  }

  private close() {
    document.getElementById("qelp-widget-sheet")?.classList.remove("qelp-open");
  }

  private async submit(payload: FeedbackPayload) {
    if (!this.config) throw new Error("Widget has not been initialized.");

    const response = await fetch(`${this.config.apiBaseUrl}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-qelp-project-key": this.config.projectKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Feedback submission failed.");
    return response.json();
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
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
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
  open: () => widget.open()
};
