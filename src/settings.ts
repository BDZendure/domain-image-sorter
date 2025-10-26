import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import type DomainImageSorter from './main';

export interface DomainFolderMapping {
	domain: string;
	folder: string;
}

export interface DISSettings { // Domain Image Sorter Settings
	mappings: DomainFolderMapping[];
}

export const DEFAULT_SETTINGS: DISSettings = {
	mappings: [],
};

export class SettingsTab extends PluginSettingTab {
	plugin: DomainImageSorter;

	constructor(app: App, plugin: DomainImageSorter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// container for the mappings; rows inside will each be a grid
		const mappingsArea = containerEl.createDiv({ cls: "domain-image-sorter-mappings" });

		// Header row (shares the same column sizing as mapping rows)
		const headerRow = document.createElement('div');
		headerRow.className = 'dis-row dis-header-row';
		const h1 = document.createElement('div');
		h1.className = 'dis-col-head';
		h1.textContent = 'Domain';
		headerRow.appendChild(h1);
		const h2 = document.createElement('div');
		h2.className = 'dis-col-head';
		h2.textContent = 'Image folder';
		headerRow.appendChild(h2);
		const h3 = document.createElement('div');
		h3.className = 'dis-col-head';
		h3.textContent = '';
		headerRow.appendChild(h3);
		mappingsArea.appendChild(headerRow);

		// divider between header and first mapping
		const headerDivider = document.createElement('div');
		headerDivider.className = 'dis-header-divider';
		mappingsArea.appendChild(headerDivider);

		// iterates over saved mappings and creates a new grid row aligned under headings
		this.plugin.settings.mappings.forEach((rule, index) => {
			// Create a row so the three cells share the same grid columns
			const row = document.createElement('div');
			row.className = 'dis-row';

			// DOMAIN CELL
			const domainCell = document.createElement('div');
			domainCell.className = 'dis-cell';
			const domainInput = document.createElement('input');
			domainInput.type = 'text';
			domainInput.placeholder = "e.g. example.com";
			domainInput.className = 'dis-input dis-domain-input';
			domainInput.value = rule.domain;
			domainInput.oninput = async (e: Event) => {
				const input = e.currentTarget as HTMLInputElement;
				this.plugin.settings.mappings[index].domain = input.value.trim();
				await this.plugin.saveSettings();
			};
			domainCell.appendChild(domainInput);
			row.appendChild(domainCell);

			// FOLDER CELL
			const folderCell = document.createElement('div');
			folderCell.className = 'dis-cell';
			const folderInput = document.createElement('input');
			folderInput.type = 'text';
			folderInput.placeholder = "e.g. folder/subfolder";
			folderInput.className = 'dis-input dis-folder-input';
			folderInput.value = rule.folder;
			folderInput.oninput = async (e: any) => {
				this.plugin.settings.mappings[index].folder = (e.target as HTMLInputElement).value.trim();
				await this.plugin.saveSettings();
			};
			folderCell.appendChild(folderInput);
			row.appendChild(folderCell);
			this.attachFolderSuggester(folderInput, index);

			// ACTION CELL (delete button)
			const actionCell = document.createElement('div');
			actionCell.className = 'dis-action-cell';
			const del = document.createElement('button');
			del.className = 'mod-cta';
			del.textContent = '✕';
			del.onclick = async () => {
				this.plugin.settings.mappings.splice(index, 1);
				await this.plugin.saveSettings();
				this.display();
			};
			actionCell.appendChild(del);
			row.appendChild(actionCell);

			mappingsArea.appendChild(row);

			// full-width divider below each mapping (except the last)
			if (index < this.plugin.settings.mappings.length - 1) {
				const divider = document.createElement('div');
				divider.className = 'dis-divider';
				mappingsArea.appendChild(divider);
			}
		});
		//ADD MAPPING BUTTON
		new Setting(containerEl)
			.addButton(b => b
				.setButtonText("Add mapping")
				.onClick(async () => {
					this.plugin.settings.mappings.push({ domain: "", folder: "" });
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}

	// FOLDER SUGGESTER
	private attachFolderSuggester(inputEl: HTMLInputElement, ruleIndex: number): void {
		// ensure wrapper exists and has the right class
		if (!inputEl.parentElement?.classList.contains('dis-folder-wrapper')) {
			const wrapper = document.createElement('div');
			wrapper.className = 'dis-folder-wrapper';
			inputEl.parentElement?.insertBefore(wrapper, inputEl);
			wrapper.appendChild(inputEl);
		}

		const wrapperEl = inputEl.parentElement as HTMLElement;
		const suggestEl = document.createElement('div');
		suggestEl.className = 'dis-folder-suggest';
		wrapperEl.appendChild(suggestEl);

		let activeIndex = -1;
		let currentItems: HTMLDivElement[] = [];

		const getAllFolderPaths = (): string[] => (this.app.vault.getAllLoadedFiles() as any[])
			.filter(f => f instanceof TFolder)
			.map((f: TFolder) => f.path)
			.filter(p => p && p !== '.')
			.sort((a: string, b: string) => a.localeCompare(b));

		const clearActive = () => {
			currentItems.forEach(i => i.classList.remove('is-active'));
		};

		const setActive = (idx: number) => {
			if (!currentItems.length) return;
			if (idx < 0) idx = currentItems.length - 1;
			if (idx >= currentItems.length) idx = 0;
			activeIndex = idx;
			clearActive();
			currentItems[activeIndex].classList.add('is-active');
			currentItems[activeIndex].scrollIntoView({ block: 'nearest' });
		};

		const selectItem = async (div: HTMLDivElement | undefined) => {
			if (!div) return;
			const value = div.getAttribute('data-path')!;
			inputEl.value = value;
			this.plugin.settings.mappings[ruleIndex].folder = value;
			await this.plugin.saveSettings();
			hide();
		};

		const hide = () => {
			suggestEl.style.display = 'none';
			activeIndex = -1;
		};

		const fuzzyScore = (text: string, q: string) => {
			if (!q) return 0;
			const t = text.toLowerCase();
			const s = q.toLowerCase();
			const idx = t.indexOf(s);
			if (idx !== -1) return idx;
			let i = 0;
			for (let ch of s) {
				i = t.indexOf(ch, i);
				if (i === -1) return 9999;
				i++;
			}
			return 5000;
		};

		const highlightMatch = (text: string, q: string): DocumentFragment => {
			const frag = document.createDocumentFragment();
			if (!q) {
				frag.appendChild(document.createTextNode(text));
				return frag;
			}
			const t = text;
			const s = q.toLowerCase();
			const idx = t.toLowerCase().indexOf(s);
			if (idx === -1) {
				frag.appendChild(document.createTextNode(t));
				return frag;
			}
			const before = t.slice(0, idx);
			const match = t.slice(idx, idx + q.length);
			const after = t.slice(idx + q.length);
			frag.appendChild(document.createTextNode(before));
			const strong = document.createElement('strong');
			strong.textContent = match;
			frag.appendChild(strong);
			frag.appendChild(document.createTextNode(after));
			return frag;
		};

		const render = () => {
			const val = inputEl.value.trim();
			const all = getAllFolderPaths()
				.map(p => ({ p, score: fuzzyScore(p, val) }))
				.filter(x => val === '' || x.score < 9999)
				.sort((a, b) => a.score - b.score)
				.slice(0, 100)
				.map(x => x.p);

			// clear prev suggestions
			if (suggestEl.replaceChildren) suggestEl.replaceChildren(); else while (suggestEl.firstChild) suggestEl.removeChild(suggestEl.firstChild);
			currentItems = [];
			activeIndex = -1;

			if (!all.length) {
				hide();
				return;
			}

			all.forEach((p, idx) => {
				const item = document.createElement('div');
				item.className = 'dis-folder-suggest-item';
				const frag = highlightMatch(p, val);
				item.appendChild(frag);
				item.setAttribute('data-path', p);
				item.addEventListener('mouseenter', () => {
					clearActive();
					activeIndex = idx;
					item.classList.add('is-active');
				});
				item.addEventListener('mouseleave', () => item.classList.remove('is-active'));
				item.addEventListener('click', () => selectItem(item));
				suggestEl.appendChild(item);
				currentItems.push(item as HTMLDivElement);
			});
			suggestEl.style.display = 'block';
			setActive(0);
		};

		inputEl.addEventListener('input', render);
		inputEl.addEventListener('focus', render);
		inputEl.addEventListener('blur', () => setTimeout(hide, 160));
		inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if (suggestEl.style.display === 'none') return;
			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					setActive(activeIndex + 1);
					break;
				case 'ArrowUp':
					e.preventDefault();
					setActive(activeIndex - 1);
					break;
				case 'Enter':
					if (activeIndex >= 0) {
						e.preventDefault();
						selectItem(currentItems[activeIndex]);
					}
					break;
				case 'Escape':
					hide();
					break;
			}
		});
	}
}


//TODO
/*
- move hardcoded styling to separate CSS file
*/