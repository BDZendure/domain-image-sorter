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

		// grid layout
		const mappingsArea = containerEl.createDiv({ cls: "domain-image-sorter-mappings" });
		mappingsArea.style.display = "grid";
		mappingsArea.style.gridTemplateColumns = "40% 40% 20%";
		mappingsArea.style.columnGap = "8px";
		mappingsArea.style.padding = '6px 14px';

		// header cells inside the same grid
		mappingsArea.createEl("div", { text: "Domain", cls: "dis-col-head" });
		mappingsArea.createEl("div", { text: "Image Folder", cls: "dis-col-head" });
		mappingsArea.createEl("div", { text: "", cls: "dis-col-head" });
		
		// divider between header and first mapping
		const headerDivider = document.createElement('div');
		headerDivider.style.gridColumn = '1 / -1';
		headerDivider.style.borderTop = '1px solid var(--background-modifier-border)';
		headerDivider.style.margin = '6px 0 12px 0';
		mappingsArea.appendChild(headerDivider);

		//iterates over saved mappings and creates a new grid row aligned under headings
		this.plugin.settings.mappings.forEach((rule, index) => {
			
			//DOMAIN CELLS
			const domainCell = document.createElement('div');
			const domainInput = document.createElement('input');
			domainInput.type = 'text';
			domainInput.placeholder = "e.g. example.com";
			
			// sizing
			domainInput.style.width = '100%';
			domainInput.style.height = '34px';
			domainInput.style.padding = '8px 8px';
			domainInput.style.boxSizing = 'border-box';
			domainInput.style.fontSize = '13px';
			domainInput.value = rule.domain;

			//updates the settings object whenever input changes (user types)
			domainInput.oninput = async (e: Event) => {
    			const input = e.currentTarget as HTMLInputElement;
    			this.plugin.settings.mappings[index].domain = input.value.trim();
    			await this.plugin.saveSettings();
			};
			domainCell.appendChild(domainInput);
			
			//IMAGE FOLDER CELLS
			domainCell.style.padding = '10px 6px';
			mappingsArea.appendChild(domainCell);

			const folderCell = document.createElement('div');
			const folderInput = document.createElement('input');
			folderInput.type = 'text';
			folderInput.placeholder = "e.g. folder/subfolder";
			folderInput.style.width = '100%';
			folderInput.style.height = '34px';
			folderInput.style.padding = '8px 8px';
			folderInput.style.boxSizing = 'border-box';
			folderInput.style.fontSize = '13px';
			folderInput.value = rule.folder;
			folderInput.oninput = async (e: any) => {
				this.plugin.settings.mappings[index].folder = (e.target as HTMLInputElement).value.trim();
				await this.plugin.saveSettings();
			};
			folderCell.appendChild(folderInput);
			folderCell.style.padding = '10px 6px';
			mappingsArea.appendChild(folderCell);

			this.attachFolderSuggester(folderInput, index);

			// DELETE BUTTON
			const actionCell = document.createElement('div');
			actionCell.style.display = 'flex';
			actionCell.style.alignItems = 'center';
			const del = document.createElement('button');
			del.className = 'mod-cta';
			del.textContent = '✕';
			del.onclick = async () => {
				this.plugin.settings.mappings.splice(index, 1); // remove mapping
				await this.plugin.saveSettings();
				this.display();
			};
			actionCell.appendChild(del);
			actionCell.style.padding = '10px 6px';
			mappingsArea.appendChild(actionCell);

			//full-width divider below each mapping (except the last)
			if (index < this.plugin.settings.mappings.length - 1) { 
				const divider = document.createElement('div');
				divider.style.gridColumn = '1 / -1'; //span entire grid width
				divider.style.borderTop = '1px solid var(--background-modifier-border)';
				divider.style.margin = '10px 0'; //space between mappings
				mappingsArea.appendChild(divider);
			}
		});

		//ADD MAPPING BUTTON
		new Setting(containerEl)
			.addButton(b => b
				.setButtonText("Add Mapping")
				.onClick(async () => {
					this.plugin.settings.mappings.push({ domain: "", folder: "" });
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}

	//FOLDER SUGGESTER
	private attachFolderSuggester(inputEl: HTMLInputElement, ruleIndex: number): void {
		if (!inputEl.parentElement?.classList.contains('dis-folder-wrapper')) {
			const wrapper = document.createElement('div');
			wrapper.className = 'dis-folder-wrapper';
			wrapper.style.position = 'relative'; //wrapper fills the available grid cell horizontally
			wrapper.style.width = '100%';
			wrapper.style.display = 'flex';
			wrapper.style.flexDirection = 'column';
			wrapper.style.alignItems = 'stretch';
			inputEl.parentElement?.insertBefore(wrapper, inputEl);
			wrapper.appendChild(inputEl);
			inputEl.style.width = '100%'; 
		}
		const wrapperEl = inputEl.parentElement as HTMLElement;

		const suggestEl = document.createElement('div');
		suggestEl.className = 'dis-folder-suggest';
			Object.assign(suggestEl.style, {
			position: 'absolute',
			top: '100%',
			left: '0',
			width: '100%',
			marginTop: '4px',
			background: 'var(--background-primary)',
			border: '1px solid var(--background-modifier-border)',
			borderRadius: '4px',
			boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
			padding: '4px 0',
			zIndex: '999',
			maxHeight: '240px',
			overflowY: 'auto',
				display: 'none',
				fontSize: '13px' 
		} as CSSStyleDeclaration);
		wrapperEl.appendChild(suggestEl);

		let activeIndex = -1;
		let currentItems: HTMLDivElement[] = [];

		//returns a sorted array of folder path strings suitable for suggestion
		const getAllFolderPaths = (): string[] => (this.app.vault.getAllLoadedFiles() as any[])
			.filter(f => f instanceof TFolder)
			.map((f: TFolder) => f.path)
			.filter(p => p && p !== '.')
			.sort((a: string, b: string) => a.localeCompare(b));

		//Clear any active selection styling
		const clearActive = () => {
			currentItems.forEach(i => {
				i.classList.remove('is-active');
				i.style.background = '';
				i.style.color = '';
				i.style.fontWeight = '';
			});
		};
		//Set the active suggestion by index, wraps around if needed
		const setActive = (idx: number) => {
			if (!currentItems.length) return;
			if (idx < 0) idx = currentItems.length - 1;
			if (idx >= currentItems.length) idx = 0;
			activeIndex = idx;
			clearActive();
			const el = currentItems[activeIndex];
			el.classList.add('is-active');
			el.style.background = 'var(--background-modifier-hover)'; 
			//el.style.fontWeight = '600'; //bolden active item if needed
			el.scrollIntoView({ block: 'nearest' });
		};

		//Apply selection, save data, and hide the list
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

		//FUZZY SORTER
		const fuzzyScore = (text: string, q: string) => {
			if (!q) return 0;
			const t = text.toLowerCase();
			const s = q.toLowerCase();
			const idx = t.indexOf(s);
			if (idx !== -1) return idx; // earlier match is better
			// subsequence fallback
			let i = 0;
			for (let ch of s) {
				i = t.indexOf(ch, i);
				if (i === -1) return 9999;
				i++;
			}
			return 5000;
		};

		const highlightMatch = (text: string, q: string) => {
			if (!q) return escapeHtml(text);
			const t = text;
			const s = q.toLowerCase();
			const idx = t.toLowerCase().indexOf(s);
			if (idx === -1) return escapeHtml(t);
			const before = escapeHtml(t.slice(0, idx));
			const match = escapeHtml(t.slice(idx, idx + q.length));
			const after = escapeHtml(t.slice(idx + q.length));
			return `${before}<strong>${match}</strong>${after}`;
		};

		const render = () => {
			const val = inputEl.value.trim();
			const all = getAllFolderPaths()
				.map(p => ({ p, score: fuzzyScore(p, val) }))
				.filter(x => val === '' || x.score < 9999)
				.sort((a, b) => a.score - b.score)
				.slice(0, 100)
				.map(x => x.p);

			suggestEl.innerHTML = '';
			currentItems = [];
			activeIndex = -1;

			if (!all.length) {
				hide();
				return;
			}

			all.forEach((p, idx) => {
				const item = document.createElement('div');
				item.className = 'dis-folder-suggest-item';
				item.innerHTML = highlightMatch(p, val);
				item.setAttribute('data-path', p);
				Object.assign(item.style, {
					padding: '6px 10px',
					cursor: 'pointer',
					// larger than input text for better visibility
					fontSize: '14px',
					whiteSpace: 'nowrap',
					textOverflow: 'ellipsis',
					overflow: 'hidden'
				} as CSSStyleDeclaration);
				item.onmouseenter = () => {
					clearActive();
					activeIndex = idx;
					item.classList.add('is-active');
				};
				item.onmouseleave = () => item.classList.remove('is-active');
				item.onclick = () => selectItem(item);
				suggestEl.appendChild(item);
				currentItems.push(item as HTMLDivElement);
			});
			suggestEl.style.display = 'block';
			// default to the first suggestion being active so keyboard arrows work immediately
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

//replaces special char with escaped ver. so html displays correctly in dropdown
function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}