export class App {}
export class TFile {}
export class TFolder {}
export class Component { load(): void {} unload(): void {} }
export class MarkdownRenderer {
  static async render(_app: App, _markdown: string, _el: HTMLElement, _source: string, _comp: Component): Promise<void> {}
}
export class ItemView {}
export class WorkspaceLeaf {}
export class Notice {
  constructor(_message: string) {}
}
export class PluginSettingTab {}
export class Setting {
  constructor(_container: HTMLElement) {}
  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  addText(_cb: (text: any) => void): this { return this; }
  addTextArea(_cb: (text: any) => void): this { return this; }
  addDropdown(_cb: (dropdown: any) => void): this { return this; }
}
export class TextComponent { inputEl!: HTMLInputElement }
export function requestUrl(_req: any): any {
  return { status: 200, json: {}, text: "" };
}
export function normalizePath(path: string): string { return path; }
export const Plugin = class {};
