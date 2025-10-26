import { App, Plugin, TFile, normalizePath } from 'obsidian';
import { SettingsTab, DISSettings, DEFAULT_SETTINGS, DomainFolderMapping } from './settings';


import * as jsYaml from 'js-yaml'; 

export default class DomainImageSorter extends Plugin {
	settings: DISSettings;

	async onload() {
		console.log('loading plugin');
		await this.loadSettings();

		this.addSettingTab(new SettingsTab(this.app, this));

		//wait for Web Clipper to finish writing the file
		this.app.workspace.onLayoutReady(() => {
			// Register create and modify events
			this.registerEvent(this.app.vault.on('create', this.onCreate, this));
			//this.registerEvent(this.app.vault.on('modify', this.onModify, this));
		});
	}

	onunload() {
		console.log('unloading plugin');
		//clean up resources when plugin disabled
		//nothing for now...
	}

	//helper functions for settings
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	//ensures only processes md files
	private isMarkdownFile(file: TFile) {
		return file && file.extension === 'md';
	}

	//EVENT HANDLERS
	private async onCreate(file: TFile) {
		if (!this.isMarkdownFile(file)) return;
		//small delay - wait for clipper to finish writing metadata
		await this.sleep(300); 
		await this.processFile(file);
		//setTimeout(() => this.processFile(file), 300);
	}

	

	/*
	//for future version maybe with automatic file detection. 
	private async onModify(file: TFile) {
		if (!this.isMarkdownFile(file)) return;
		await this.processFile(file);
	}
	*/

	private async processFile(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!yamlMatch) return;
			const yamlText = yamlMatch[1];
			let data: any = {};
			try {
				data = jsYaml.load(yamlText) || {}; //parse into object
			} catch (e) {
				console.warn('YAML parse failed', e);
				return;
			}

			// determine link domain
			const link = data['Link'] || data['link'] || data['url'];
			const imageUrl = data['image'] || data['Image'] || data['cover'];
			if (!imageUrl) return;

			const domain = this.extractDomain(link || '');
			const mapping = this.matchMapping(domain);

			//construct filename from title-author
			const title = (data['title'] || data['Title'] || file.basename).toString();
			const author = (data['author'] || data['Author'] || '').toString();
			const baseName = this.sanitizeFilename(author ? `${title}-${author}` : title);

			// fetch image
			const fetchResult = await this.downloadImage(imageUrl);
			if (!fetchResult) return;

			const imageData = fetchResult.data; //should be Uint8Array
			const contentType = fetchResult.contentType || ''; //MIME type from browser

			// determine target folder
			const folder = mapping?.folder || '';
			const detectedExt = this.extFromUrl(imageUrl) || this.extFromMime(contentType) || '.jpg'; //determine extension, fallback to .jpg
			const fileName = `${baseName}${detectedExt}`;
			const targetPath = normalizePath((folder ? folder + '/' : '') + fileName);

			// ensure target folder exists
			const folderPath = folder ? normalizePath(folder) : '';
			if (folderPath) {
				try {
					await this.app.vault.createFolder(folderPath);
				} catch (e) {
					// ignore if exists
				}
			}

			// save binary attachment
			try {
				const existing = this.app.vault.getAbstractFileByPath(targetPath);
				if (existing) {
					await this.app.vault.delete(existing);
				}
			} catch (e) {}
			try {
				await (this.app.vault as any).createBinary(targetPath, imageData);
			} catch (e) {
				console.error('Failed to save image to vault', e);
				return;
			}

			// Update YAML to Point to Local Image
			data['image'] = `[[${fileName}]]`;
			const newYaml = jsYaml.dump(data); 
			const newContent = content.replace(/^---\n([\s\S]*?)\n---/, `---\n${newYaml}---`); //replace old yaml block
			await this.app.vault.modify(file, newContent);
		} catch (e) {
			console.error('Process file failed', e);
		}
	}

	//find right folder
	private matchMapping(domain: string): DomainFolderMapping | null {
		if (!domain) return null;
		for (const m of (this.settings.mappings || [])) {
			if (!m.domain) continue;
			if (domain === m.domain || domain.endsWith('.' + m.domain)) return m;
		}
		return null;
	}

	//extracts domain from url link
	private extractDomain(link: string): string {
		try {
			if (!link) return '';
			const url = new URL(link, 'http://example'); //through URL API
			const domain = url.hostname;
			return domain.replace(/^www\./, '');
		} catch (e) {
			return '';
		}
	}

	//infer
	private extFromUrl(url: string): string | null {
		try {
			const u = new URL(url);
			const parts = u.pathname.split('.');
			if (parts.length > 1) return '.' + parts.pop();
			return null;
		} catch (e) {
			// fallback
			const m = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(?:\?|$)/i);
			if (m) {
				return '.' + m[1];
			} else {
				return null;
			}
		}
	}

	//infer
	private extFromMime(mime: string | null | undefined): string | null {
		if (!mime) return null;
		const m = mime.toLowerCase();
		if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
		if (m.includes('png')) return '.png';
		if (m.includes('gif')) return '.gif';
		if (m.includes('webp')) return '.webp';
		if (m.includes('bmp')) return '.bmp';
		return null;
	}

	private async downloadImage(url: string): Promise<{ data: Uint8Array, contentType?: string } | null> {
		try {
			const resp = await fetch(url, { method: 'GET' });
			if (!resp.ok) {
				console.error('Download failed: ', resp.status, resp.statusText);
				return null;
			}
			const contentType = resp.headers.get('content-type') || undefined;
			const ab = await resp.arrayBuffer();
			return { data: new Uint8Array(ab), contentType }; //ensure Uint8Array
		} catch (e) {
			console.error('Download failed', e);
			return null;
		}
	}

	private sanitizeFilename(name: string) {
		// remove characters that are problematic in filenames and YAML
		return name
			.replace(/[\\/:*?"<>|]+/g, '') // common illegal filesystem chars
			.replace(/#/g, '') //breaks YAML (often present in book series titles)
			.replace(/\s+/g, ' ')
			.trim();
	}

	private sleep(ms: number) {
		return new Promise((r) => setTimeout(r, ms));
	}
}


/*
NOTES:
I don't think js-yaml actually needed. Regex replacing works. js-yaml safer though.  
*/
