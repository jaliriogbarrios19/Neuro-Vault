import { App, TFile } from "obsidian";

export class FileAutocomplete {
  private app: App;
  private inputEl: HTMLTextAreaElement;
  private dropdownEl: HTMLElement | null = null;
  private suggestions: TFile[] = [];
  private selectedIndex = 0;
  private onSelectCb: (path: string) => void;
  private previewEl: HTMLElement | null = null;

  constructor(app: App, inputEl: HTMLTextAreaElement, onSelect: (path: string) => void) {
    this.app = app;
    this.inputEl = inputEl;
    this.onSelectCb = onSelect;
    this.inputEl.addEventListener("input", () => this.onInput());
    this.inputEl.addEventListener("keydown", (e) => this.onKeydown(e));
  }

  destroy(): void {
    this.hideDropdown();
    this.hidePreview();
  }

  private onInput(): void {
    const query = this.extractQuery();
    if (!query) {
      this.hideDropdown();
      return;
    }
    this.searchFiles(query);
    if (this.suggestions.length > 0) {
      this.showDropdown();
    } else {
      this.hideDropdown();
    }
  }

  private extractQuery(): string | null {
    const text = this.inputEl.value;
    const cursor = this.inputEl.selectionStart;
    const before = text.slice(0, cursor);
    const match = before.match(/@([^\s]*)$/);
    return match ? match[1] : null;
  }

  private searchFiles(query: string): void {
    const files = this.app.vault.getFiles();
    const lower = query.toLowerCase();
    this.suggestions = files
      .filter((f) => f.path.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aStart = a.path.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStart = b.path.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStart - bStart || a.path.length - b.path.length;
      })
      .slice(0, 6);
    this.selectedIndex = 0;
  }

  private showDropdown(): void {
    this.hideDropdown();
    this.dropdownEl = document.createElement("div");
    this.dropdownEl.className = "neuro-vault-autocomplete";
    for (let i = 0; i < this.suggestions.length; i++) {
      const file = this.suggestions[i];
      const item = this.dropdownEl.createDiv("neuro-vault-autocomplete-item");
      if (i === this.selectedIndex) item.addClass("neuro-vault-autocomplete-selected");
      const icon = item.createSpan({ cls: "neuro-vault-autocomplete-icon" });
      icon.textContent = file.extension === "md" ? "\u{1F4C4}" : "\u{1F4C1}";
      const pathEl = item.createSpan({ cls: "neuro-vault-autocomplete-path" });
      pathEl.textContent = file.path;
      item.addEventListener("click", () => this.select(file.path));
      item.addEventListener("mouseenter", () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
    }
    const parent = this.inputEl.parentElement;
    if (parent) {
      parent.addClass("neuro-vault-autocomplete-parent");
      parent.insertBefore(this.dropdownEl, this.inputEl);
    }
  }

  private hideDropdown(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }
  }

  private updateSelection(): void {
    if (!this.dropdownEl) return;
    const items = this.dropdownEl.querySelectorAll(".neuro-vault-autocomplete-item");
    items.forEach((el, i) => {
      if (i === this.selectedIndex) el.addClass("neuro-vault-autocomplete-selected");
      else el.removeClass("neuro-vault-autocomplete-selected");
    });
  }

  private select(path: string): void {
    const text = this.inputEl.value;
    const cursor = this.inputEl.selectionStart;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const atIdx = before.lastIndexOf("@");
    const newText = before.slice(0, atIdx) + "@" + path + " " + after;
    this.inputEl.value = newText;
    const newCursor = atIdx + path.length + 2;
    this.inputEl.setSelectionRange(newCursor, newCursor);
    this.inputEl.focus();
    this.hideDropdown();
    this.onSelectCb(path);
    this.showPreview(path);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.dropdownEl) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
      this.updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelection();
    } else if (e.key === "Enter" && this.dropdownEl) {
      const isCollapsed = !this.inputEl.value.includes("\n");
      if (isCollapsed || e.shiftKey) return;
      e.preventDefault();
      this.select(this.suggestions[this.selectedIndex].path);
    } else if (e.key === "Escape") {
      this.hideDropdown();
    } else if (e.key === "Tab" && this.dropdownEl) {
      e.preventDefault();
      this.select(this.suggestions[this.selectedIndex].path);
    }
  }

  private async showPreview(path: string): Promise<void> {
    this.hidePreview();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !("extension" in file)) return;
    const tfile = file as TFile;
    const content = await this.app.vault.cachedRead(tfile);
    const parent = this.inputEl.parentElement;
    if (!parent) return;
    this.previewEl = document.createElement("div");
    this.previewEl.className = "neuro-vault-file-preview";
    const header = this.previewEl.createDiv({ cls: "neuro-vault-file-preview-header" });
    header.createSpan({ text: path, cls: "neuro-vault-file-preview-path" });
    const closeBtn = header.createSpan({ text: "✕", cls: "neuro-vault-file-preview-close" });
    closeBtn.addEventListener("click", () => this.hidePreview());
    const body = this.previewEl.createDiv({ cls: "neuro-vault-file-preview-body" });
    const truncated = content.length > 2000;
    body.textContent = truncated ? content.slice(0, 2000) + "\n…" : content;
    parent.appendChild(this.previewEl);
  }

  private hidePreview(): void {
    if (this.previewEl) {
      this.previewEl.remove();
      this.previewEl = null;
    }
  }
}
