export class VoiceInput {
  private recognition: any | null = null;
  private isListening = false;
  private btnEl: HTMLElement | null = null;

  isSupported(): boolean {
    const w = window as any;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  attach(btn: HTMLElement, inputEl: HTMLTextAreaElement): void {
    if (!this.isSupported()) {
      btn.addClass("nv-hidden");
      return;
    }
    this.btnEl = btn;
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      inputEl.value = transcript;
      inputEl.dispatchEvent(new Event("input"));
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateBtn();
    };

    this.recognition.onerror = () => {
      this.isListening = false;
      this.updateBtn();
    };

    btn.addEventListener("click", () => this.toggle());
  }

  private toggle(): void {
    if (this.isListening) {
      this.recognition?.stop();
    } else {
      this.recognition?.start();
      this.isListening = true;
    }
    this.updateBtn();
  }

  private updateBtn(): void {
    if (!this.btnEl) return;
    this.btnEl.toggleClass("neuro-vault-voice-active", this.isListening);
    this.btnEl.textContent = this.isListening ? "⏹" : "🎤";
  }

  destroy(): void {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
  }
}
