import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, normalizePath, FileSystemAdapter } from 'obsidian';
import * as fs from 'fs';

interface ListPluginsSettings {
	listPluginsNoteName: string;
	listPluginsNotePath: string;
}

const DEFAULT_SETTINGS: ListPluginsSettings = {
	listPluginsNoteName: '',
	listPluginsNotePath: ''
}

interface manifestPluginDetails {
	id: string;
    name: string;
    version: string;
    minAppVersion: string;
    description: string;
    author: string;
    authorUrl: string;
    isDesktopOnly: boolean;
}

interface communityPluginDetails {
	id: string;
	name: string;
	author: string;
	branch: string;
	description: string;
	repo: string;
}

export default class ListPluginsPlugin extends Plugin {
	settings: ListPluginsSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('toy-brick', 'List Plugins: generate list', async (evt: MouseEvent) => {

			this.makeListFile();

		});
		
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'list-plugins-generate-list',
			name: 'List Plugins: generate list',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						console.log("command can be run");
						this.makeListFile();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ListPluginsSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		// Nothing.
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * @summary Generates the file containing the list of user's plugins.
	 */
	async makeListFile() {
		
		const communityPluginsUrl = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

		let fileName = "";
		let filePath = "";
		let fileContents = "";

		let allPlugins: communityPluginDetails[] = [];
		let listOfPluginManifests: manifestPluginDetails[];
		let installedPluginsCount = 0;

		if(this.settings.listPluginsNoteName.trim() == "") {
			fileName = "List of Plugins - " + formatDate(new Date());
		} else {
			fileName = normalizePath(this.settings.listPluginsNoteName);
		}

		filePath = normalizePath(this.settings.listPluginsNotePath + "/" + fileName + ".md");

		if (await this.app.vault.adapter.exists(filePath)) {
			new Notice(`${fileName} already exists!`);
		} else {
	
			fetch(communityPluginsUrl)
				.then(res => res.json())
				.then((out) => {

					allPlugins = out;

					const pluginsDirPath = this.getAbsolutePath();
					const installedPlugins = fs.readdirSync(pluginsDirPath);

					listOfPluginManifests = [];
					installedPlugins.forEach(pluginManifest => {
						const manifestFile = pluginsDirPath + "/" + pluginManifest + "/manifest.json";
						const stats = fs.statSync(manifestFile);
						if(stats.isFile()) {
							const rawData = fs.readFileSync(manifestFile);
							const pluginData = JSON.parse(rawData.toString());
							listOfPluginManifests.push(pluginData);
						}
					});

					listOfPluginManifests.forEach(pluginItem => {
						
						const found = allPlugins.find(matchingPlugin => matchingPlugin.id == pluginItem.id);
						
						if(found !== undefined) {
							
							if(fileContents.trim() == "") {
								fileContents = "name | author | open in obsidian " + "\n"
								+ "---|---|---" + "\n";
							}
							
							// "obsidian://show-plugin?id="+encodeURIComponent(h)
							// https://github.com/
							fileContents += "[" + found.name + "](https://github.com/" + found.repo + ") | "
											+ found.author + " | "
											+ "[get](obsidian://show-plugin?id=" + encodeURIComponent(found.id) + ")\n";

							installedPluginsCount++;

						}
					});

					const metaData = "## List of installed plugins\n" +
										"Curated: " + formatDate(new Date()) + "\n" +
										"Total: " + installedPluginsCount + "\n\n" +
										"---\n\n";

					fileContents = metaData + fileContents;
					this.app.vault.create(filePath, fileContents);
					new Notice(`${fileName} has been created`);

				})
				.catch(err => { throw err });

		}

	}

	/**
	 * @summary Gets the absolute path of the plugins folder in the vault.
	 * @returns Absolute path of the plugins folder in the vault.
	 */
	getAbsolutePath(): string {
        
		let basePath;

		// base path
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            basePath = this.app.vault.adapter.getBasePath();
        } else {
            throw new Error('Cannot determine base path.');
        }

        // relative path
        const relativePath = `${this.app.vault.configDir}/plugins`;
        
		// absolute path
        return `${basePath}/${relativePath}`;
    }

}

class ListPluginsSettingTab extends PluginSettingTab {
	plugin: ListPluginsPlugin;

	constructor(app: App, plugin: ListPluginsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'List Plugins Settings'});

		new Setting(containerEl)
			.setName('Note name')
			.setDesc('The name of the note to store the list of plugins. If it doesn\'t exist, a new note will be created.')
			.addText(text => text
				.setPlaceholder('name')
				.setValue(this.plugin.settings.listPluginsNoteName)
				.onChange(async (value) => {
					console.log('List plugins note name: ' + value);
					this.plugin.settings.listPluginsNoteName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Note path')
			.setDesc('Path of the note.')
			.addText(text => text
				.setPlaceholder('folder')
				.setValue(this.plugin.settings.listPluginsNotePath)
				.onChange(async (value) => {
					console.log('List plugins note path: ' + value);
					this.plugin.settings.listPluginsNotePath = value;
					await this.plugin.saveSettings();
				}));
		}
}

function padTo2Digits(num: number) {
	return num.toString().padStart(2, '0');
}

function formatDate(date: Date) {

    // YYYYMMDD_hhmmss
    return (
	[
		date.getFullYear(),
		padTo2Digits(date.getMonth() + 1),
		padTo2Digits(date.getDate()),
	].join('') +
	'_' +
	[
		padTo2Digits(date.getHours()),
		padTo2Digits(date.getMinutes()),
		padTo2Digits(date.getSeconds()),
	].join('')
	);
  }