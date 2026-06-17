export class ConversationSearch {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private barEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private highlights: HTMLElement[] = [];
  private currentIndex = -1;

  constructor(container: HTMLElement, messagesEl: HTMLElement) {
    this.container = container;
    this.messagesEl = messagesEl;
  }

  toggle(): void {
    if (this.barEl) this.close();
    else this.open();
  }

  open(): void {
    if (this.barEl) { this.inputEl?.focus(); return; }
    this.barEl = this.container.createDiv("neuro-vault-search-bar");
    this.inputEl = this.barEl.createEl("input", {
      attr: { placeholder: "Search conversation...", type: "text" },
    });
    this.countEl = this.barEl.createSpan({ cls: "neuro-vault-search-count" });
    const prevBtn = this.barEl.createEl("button", { text: "↑", cls: "neuro-vault-search-nav" });
    const nextBtn = this.barEl.createEl("button", { text: "↓", cls: "neuro-vault-search-nav" });
    const closeBtn = this.barEl.createEl("button", { text: "✕", cls: "neuro-vault-search-nav" });

    this.inputEl.addEventListener("input", () => this.search());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.next(); }
      if (e.key === "Escape") this.close();
    });
    prevBtn.addEventListener("click", () => this.prev());
    nextBtn.addEventListener("click", () => this.next());
    closeBtn.addEventListener("click", () => this.close());
    this.inputEl.focus();
  }

  close(): void {
    this.clearHighlights();
    if (this.barEl) { this.barEl.remove(); this.barEl = null; }
    this.inputEl = null;
    this.countEl = null;
  }

  private search(): void {
    this.clearHighlights();
    const query = this.inputEl?.value.trim().toLowerCase();
    if (!query || !this.countEl) { if (this.countEl) this.countEl.textContent = ""; return; }

    const contentEls = this.messagesEl.querySelectorAll(".neuro-vault-message-content");
    let total = 0;

    contentEls.forEach((el) => {
      const text = el.textContent || "";
      const lower = text.toLowerCase();
      let startIdx = 0;
      let idx: number;
      while ((idx = lower.indexOf(query, startIdx)) !== -1) {
        total++;
        this.highlightMatch(el as HTMLElement, idx, query.length);
        startIdx = idx + query.length;
      }
    });

    this.countEl.textContent = total > 0 ? `${total} match${total > 1 ? "es" : ""}` : "No matches";
    this.currentIndex = total > 0 ? 0 : -1;
    if (total > 0) this.scrollToCurrent();
  }

  private highlightMatch(parent: HTMLElement, start: number, length: number): void {
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const nodeLen = node.length;
      if (pos + nodeLen > start) {
        const localStart = start - pos;
        const localEnd = Math.min(localStart + length, nodeLen);
        const range = document.createRange();
        range.setStart(node, localStart);
        range.setEnd(node, localEnd);
        const mark = document.createElement("mark");
        mark.className = "neuro-vault-search-highlight";
        range.surroundContents(mark);
        this.highlights.push(mark);
        return;
      }
      pos += nodeLen;
    }
  }

  private clearHighlights(): void {
    for (const el of this.highlights) {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    }
    this.highlights = [];
    this.currentIndex = -1;
  }

  next(): void {
    if (this.highlights.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.highlights.length;
    this.scrollToCurrent();
  }

  prev(): void {
    if (this.highlights.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.highlights.length) % this.highlights.length;
    this.scrollToCurrent();
  }

  private scrollToCurrent(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.highlights.length) return;
    for (let i = 0; i < this.highlights.length; i++) {
      this.highlights[i].toggleClass("neuro-vault-search-current", i === this.currentIndex);
    }
    this.highlights[this.currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    if (this.countEl) {
      this.countEl.textContent = `${this.currentIndex + 1}/${this.highlights.length}`;
    }
  }
}
