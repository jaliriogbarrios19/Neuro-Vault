import type { LLMModel } from "./types";

export class ModelAutocomplete {
  private triggerEl: HTMLElement;
  private dropdownEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private models: LLMModel[];
  private filtered: LLMModel[] = [];
  private selectedIndex = 0;
  private onSelectCb: (modelId: string) => void;
  private maxResults = 20;

  constructor(
    triggerEl: HTMLElement,
    models: LLMModel[],
    onSelect: (modelId: string) => void
  ) {
    this.triggerEl = triggerEl;
    this.models = models;
    this.onSelectCb = onSelect;
    this.triggerEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.dropdownEl ? this.close() : this.open();
    });
  }

  private open(): void {
    this.filtered = [...this.models].slice(0, this.maxResults);
    this.selectedIndex = 0;
    this.renderDropdown();
    window.setTimeout(() => this.searchInput?.focus(), 10);
  }

  private onSearchInput(): void {
    const query = (this.searchInput?.value || "").toLowerCase().trim();
    this.filtered = this.models.filter(
      (m) =>
        m.label.toLowerCase().includes(query) ||
        m.modelId.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
    ).slice(0, this.maxResults);
    this.selectedIndex = 0;
    this.renderList();
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
    } else if (e.key === "Enter" || e.key === "Tab") {
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

    this.searchInput = document.createElement("input");
    this.searchInput.className = "neuro-vault-model-search";
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search models...";
    this.searchInput.addEventListener("input", () => this.onSearchInput());
    this.searchInput.addEventListener("keydown", (e) => this.onKeydown(e));
    this.dropdownEl.appendChild(this.searchInput);

    const listEl = document.createElement("div");
    listEl.className = "neuro-vault-autocomplete-list";
    this.dropdownEl.appendChild(listEl);
    this.renderList();

    document.body.appendChild(this.dropdownEl);

    const rect = this.triggerEl.getBoundingClientRect();
    this.dropdownEl.style.position = "fixed";
    this.dropdownEl.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    this.dropdownEl.style.left = `${rect.left}px`;
    this.dropdownEl.style.minWidth = "280px";

    window.setTimeout(() => {
      document.addEventListener("click", this.outsideClickHandler);
    }, 0);
  }

  private outsideClickHandler = (e: MouseEvent): void => {
    if (
      this.dropdownEl &&
      !this.dropdownEl.contains(e.target as Node) &&
      e.target !== this.triggerEl
    ) {
      this.close();
    }
  };

  private renderList(): void {
    const listEl = this.dropdownEl?.querySelector(".neuro-vault-autocomplete-list");
    if (!listEl) return;
    listEl.replaceChildren();

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

      listEl.appendChild(item);
    }
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
    this.onSelectCb(model.modelId);
    this.close();
  }

  close(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
      this.searchInput = null;
    }
    document.removeEventListener("click", this.outsideClickHandler);
  }

  setModels(models: LLMModel[]): void {
    this.models = models;
  }

  destroy(): void {
    this.close();
  }
}
