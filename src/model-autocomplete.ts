import type { LLMModel } from "./types";

export class ModelAutocomplete {
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement | null = null;
  private models: LLMModel[];
  private filtered: LLMModel[] = [];
  private selectedIndex = 0;
  private onSelectCb: (modelId: string) => void;
  private maxResults = 8;

  constructor(
    inputEl: HTMLInputElement,
    models: LLMModel[],
    onSelect: (modelId: string) => void
  ) {
    this.inputEl = inputEl;
    this.models = models;
    this.onSelectCb = onSelect;
    this.attach();
  }

  private attach(): void {
    this.inputEl.addEventListener("input", () => this.onInput());
    this.inputEl.addEventListener("focus", () => this.onInput());
    this.inputEl.addEventListener("keydown", (e) => this.onKeydown(e));
    this.inputEl.addEventListener("blur", () => this.close());
  }

  private onInput(): void {
    const query = this.inputEl.value.toLowerCase().trim();
    this.filtered = this.models.filter(
      (m) =>
        m.label.toLowerCase().includes(query) ||
        m.modelId.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
    ).slice(0, this.maxResults);

    this.selectedIndex = 0;

    if (this.filtered.length > 0 && document.activeElement === this.inputEl) {
      this.renderDropdown();
    } else {
      this.close();
    }
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.dropdownEl) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.filtered.length - 1);
      this.updateHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateHighlight();
    } else if (e.key === "Enter" && this.dropdownEl) {
      e.preventDefault();
      this.select(this.filtered[this.selectedIndex]);
    } else if (e.key === "Tab" && this.dropdownEl) {
      e.preventDefault();
      this.select(this.filtered[this.selectedIndex]);
    } else if (e.key === "Escape") {
      this.close();
    }
  }

  private renderDropdown(): void {
    this.close();

    this.dropdownEl = document.createElement("div");
    this.dropdownEl.className = "neuro-vault-autocomplete";

    for (let i = 0; i < this.filtered.length; i++) {
      const m = this.filtered[i];
      const item = document.createElement("div");
      item.className = "neuro-vault-autocomplete-item";
      if (i === this.selectedIndex) item.addClass("neuro-vault-autocomplete-selected");

      const name = document.createElement("span");
      name.className = "neuro-vault-model-name";
      name.textContent = m.label;

      const desc = document.createElement("span");
      desc.className = "neuro-vault-model-desc";
      desc.textContent = m.description;

      const provider = document.createElement("span");
      provider.className = "neuro-vault-model-provider";
      provider.textContent = m.modelId.split("/")[0] || "";

      item.appendChild(name);
      item.appendChild(desc);
      item.appendChild(provider);

      item.addEventListener("click", (e) => {
        e.preventDefault();
        this.select(m);
      });
      item.addEventListener("mouseenter", () => {
        this.selectedIndex = i;
        this.updateHighlight();
      });

      this.dropdownEl.appendChild(item);
    }

    this.inputEl.parentElement?.classList.add("neuro-vault-autocomplete-parent");
    this.inputEl.parentElement?.prepend(this.dropdownEl);
  }

  private updateHighlight(): void {
    if (!this.dropdownEl) return;
    const items = this.dropdownEl.querySelectorAll(".neuro-vault-autocomplete-item");
    items.forEach((item, i) => {
      item.toggleClass("neuro-vault-autocomplete-selected", i === this.selectedIndex);
    });
  }

  private select(model: LLMModel): void {
    if (!model) return;
    this.inputEl.value = model.label;
    this.onSelectCb(model.modelId);
    this.close();
  }

  private close(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }
  }

  setModels(models: LLMModel[]): void {
    this.models = models;
  }

  destroy(): void {
    this.close();
  }
}
