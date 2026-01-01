import { Plugin, TFile, WorkspaceLeaf, MarkdownView, View, ItemView, MarkdownRenderer } from 'obsidian';

const SEARCH_TAB_VIEW_TYPE = 'search-tab-view';
const SEARCH_TAB_BACKLINKS_VIEW_TYPE = 'search-tab-backlinks-view';

class SearchTabView extends ItemView {
	plugin: SearchShortlistPlugin;
	currentFile: TFile | null = null;
	previewContainer: HTMLElement;
	mode: 'search' | 'backlinks' = 'search';
	searchBtn: HTMLButtonElement | null = null;
	backlinksBtn: HTMLButtonElement | null = null;
	embeddedLeaf: WorkspaceLeaf | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: SearchShortlistPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return SEARCH_TAB_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Search Tab';
	}

	getIcon(): string {
		return 'search';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('search-tab-container');

		// Create mode selector header
		const header = container.createDiv('search-tab-mode-header');
		header.style.display = 'flex';
		header.style.justifyContent = 'center';
		header.style.alignItems = 'center';
		header.style.padding = '8px';
		header.style.borderBottom = '1px solid var(--background-modifier-border)';
		header.style.gap = '8px';

		this.searchBtn = header.createEl('button', { text: '🔍 Search', cls: 'search-tab-mode-btn' });
		this.searchBtn.style.padding = '6px 12px';
		this.searchBtn.style.border = '1px solid var(--background-modifier-border)';
		this.searchBtn.style.borderRadius = '4px';
		this.searchBtn.style.cursor = 'pointer';
		this.searchBtn.style.backgroundColor = 'var(--interactive-accent)';
		this.searchBtn.style.color = 'var(--text-on-accent)';

		this.backlinksBtn = header.createEl('button', { text: '🔗 Backlinks', cls: 'search-tab-mode-btn' });
		this.backlinksBtn.style.padding = '6px 12px';
		this.backlinksBtn.style.border = '1px solid var(--background-modifier-border)';
		this.backlinksBtn.style.borderRadius = '4px';
		this.backlinksBtn.style.cursor = 'pointer';
		this.backlinksBtn.style.backgroundColor = 'var(--background-primary)';

		this.searchBtn.addEventListener('click', () => {
			this.setMode('search');
		});

		this.backlinksBtn.addEventListener('click', () => {
			this.setMode('backlinks');
		});

		// Create preview container
		this.previewContainer = container.createDiv('search-tab-preview');
		this.previewContainer.style.height = '100%';
		this.previewContainer.style.display = 'flex';
		this.previewContainer.style.flexDirection = 'column';

		this.showInstructions();
	}

	setMode(mode: 'search' | 'backlinks') {
		this.mode = mode;
		this.plugin.currentMode = mode;

		// Update button styles
		if (this.searchBtn && this.backlinksBtn) {
			if (mode === 'search') {
				this.searchBtn.style.backgroundColor = 'var(--interactive-accent)';
				this.searchBtn.style.color = 'var(--text-on-accent)';
				this.backlinksBtn.style.backgroundColor = 'var(--background-primary)';
				this.backlinksBtn.style.color = 'var(--text-normal)';
			} else {
				this.backlinksBtn.style.backgroundColor = 'var(--interactive-accent)';
				this.backlinksBtn.style.color = 'var(--text-on-accent)';
				this.searchBtn.style.backgroundColor = 'var(--background-primary)';
				this.searchBtn.style.color = 'var(--text-normal)';
			}
		}

		// Update search results - this will restore saved index or reset to -1 if changed
		this.plugin.updateSearchResults();
	}

	showInstructions() {
		this.previewContainer.empty();
		const instructions = this.previewContainer.createDiv('search-tab-instructions');
		instructions.style.padding = '20px';
		instructions.createEl('h3', { text: 'Search Tab' });
		instructions.createEl('p', { text: 'Use Cmd/Ctrl+↑↓ to navigate through search or backlinks results' });
		instructions.createEl('p', { text: 'Previews will appear here as you navigate' });
	}

	async displayFile(file: TFile) {
		this.currentFile = file;
		this.previewContainer.empty();

		// Auto-update Search Tab Backlinks panel if it's open
		if (this.plugin.searchTabBacklinksView) {
			await this.plugin.searchTabBacklinksView.updateBacklinks(file);
		}

		// Create content container for the embedded markdown view
		const contentContainer = this.previewContainer.createDiv('search-tab-content');
		contentContainer.style.flex = '1';
		contentContainer.style.overflow = 'auto';
		contentContainer.style.position = 'relative';

		// Track if this is the first time creating the embedded leaf
		const isFirstCreation = !this.embeddedLeaf || !this.embeddedLeaf.view;

		// Create embedded leaf ONCE for editing - keep reusing it
		if (isFirstCreation) {
			const workspace = this.app.workspace;
			this.embeddedLeaf = workspace.getLeaf('split');
			
			// Hide the tab IMMEDIATELY before any rendering
			this.closeEmptyTab(this.embeddedLeaf);
		}

		// Safety check
		if (!this.embeddedLeaf) return;

		// Open the file in the embedded leaf
		await this.embeddedLeaf.openFile(file);

		// Get the markdown view and embed it
		const markdownView = this.embeddedLeaf.view as MarkdownView;
		if (markdownView && markdownView.containerEl) {
			// Move the view's container into our content area
			contentContainer.empty();
			contentContainer.appendChild(markdownView.containerEl);
			markdownView.containerEl.style.height = '100%';
		}
	}

	closeEmptyTab(leaf: WorkspaceLeaf) {
		// Hide the entire split container that was created for the embedded leaf
		const parent = (leaf as any).parent;
		if (!parent || !parent.containerEl) return;

		// Hide the parent split container by positioning it off-screen
		// Don't use display:none to preserve event handling
		const parentContainerEl = parent.containerEl;
		if (parentContainerEl) {
			parentContainerEl.style.position = 'absolute';
			parentContainerEl.style.left = '-10000px';
			parentContainerEl.style.top = '-10000px';
			parentContainerEl.style.width = '1px';
			parentContainerEl.style.height = '1px';
			parentContainerEl.style.overflow = 'hidden';
			parentContainerEl.style.pointerEvents = 'none'; // Prevent accidental clicks
		}
	}

	async onClose() {
		// Cleanup the embedded leaf
		if (this.embeddedLeaf) {
			this.embeddedLeaf.detach();
			this.embeddedLeaf = null;
		}
		this.currentFile = null;

		// Clear the plugin's reference to this view
		if (this.plugin.searchTabView === this) {
			this.plugin.searchTabView = null;
		}
	}
}

class SearchTabBacklinksView extends ItemView {
	plugin: SearchShortlistPlugin;
	targetFile: TFile | null = null;
	backlinksContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: SearchShortlistPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return SEARCH_TAB_BACKLINKS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Search Tab Backlinks';
	}

	getIcon(): string {
		return 'links-coming-in';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('search-tab-backlinks-view');

		this.backlinksContainer = container.createDiv('backlinks-container');
		this.backlinksContainer.style.height = '100%';
		this.backlinksContainer.style.display = 'flex';
		this.backlinksContainer.style.flexDirection = 'column';
		this.backlinksContainer.style.overflow = 'hidden';

		// If Search Tab already has a file open, show its backlinks immediately
		if (this.plugin.searchTabView && this.plugin.searchTabView.currentFile) {
			await this.updateBacklinks(this.plugin.searchTabView.currentFile);
		} else {
			this.showInstructions();
		}
	}

	showInstructions() {
		this.backlinksContainer.empty();
		const instructions = this.backlinksContainer.createDiv('backlinks-instructions');
		instructions.style.padding = '20px';
		instructions.style.textAlign = 'center';
		instructions.style.color = 'var(--text-muted)';
		instructions.createEl('p', { text: 'This panel shows backlinks and unlinked mentions for the file currently displayed in Search Tab' });
		instructions.createEl('p', { text: 'Navigate through search results to see backlinks update automatically' });
	}

	async updateBacklinks(file: TFile) {
		this.targetFile = file;
		this.backlinksContainer.empty();

		// Create header showing which file's backlinks we're viewing
		const header = this.backlinksContainer.createDiv('backlinks-header');
		header.style.padding = '8px 12px';
		header.style.borderBottom = '1px solid var(--background-modifier-border)';
		header.style.backgroundColor = 'var(--background-secondary)';
		header.style.fontSize = '0.9em';
		header.style.fontWeight = '500';
		
		const fileName = header.createSpan();
		fileName.style.color = 'var(--text-normal)';
		fileName.setText(`Backlinks for: ${file.basename}`);
		
		const filePath = header.createDiv();
		filePath.style.fontSize = '0.85em';
		filePath.style.color = 'var(--text-muted)';
		filePath.style.marginTop = '2px';
		filePath.setText(file.path);

		// Get backlinks using our function (includes both linked and unlinked mentions)
		const backlinks = await this.plugin.getBacklinksForFile(file);

		if (backlinks.length === 0) {
			const noResults = this.backlinksContainer.createDiv('no-backlinks');
			noResults.style.padding = '20px';
			noResults.style.textAlign = 'center';
			noResults.style.color = 'var(--text-muted)';
			noResults.createEl('p', { text: 'No backlinks or mentions found' });
			return;
		}

		// Separate linked and unlinked mentions
		const linkedMentions = backlinks.filter(b => b.isLinked);
		const unlinkedMentions = backlinks.filter(b => !b.isLinked);

		// Create scrollable content area
		const contentArea = this.backlinksContainer.createDiv('backlinks-content');
		contentArea.style.flex = '1';
		contentArea.style.overflowY = 'auto';
		contentArea.style.padding = '8px';

		// Display linked mentions section
		if (linkedMentions.length > 0) {
			const linkedSection = contentArea.createDiv('backlinks-section');
			linkedSection.style.marginBottom = '15px';
			
			const linkedHeader = linkedSection.createDiv('backlinks-section-header');
			linkedHeader.style.padding = '6px 0';
			linkedHeader.style.fontSize = '0.9em';
			linkedHeader.style.fontWeight = '600';
			linkedHeader.style.color = 'var(--text-normal)';
			linkedHeader.createSpan({ text: `🔗 Linked mentions (${linkedMentions.length})` });
			
			const linkedList = linkedSection.createDiv('backlinks-items');
			this.renderBacklinkItems(linkedList, linkedMentions);
		}

		// Display unlinked mentions section
		if (unlinkedMentions.length > 0) {
			const unlinkedSection = contentArea.createDiv('backlinks-section');
			unlinkedSection.style.marginBottom = '15px';
			
			const unlinkedHeader = unlinkedSection.createDiv('backlinks-section-header');
			unlinkedHeader.style.padding = '6px 0';
			unlinkedHeader.style.fontSize = '0.9em';
			unlinkedHeader.style.fontWeight = '600';
			unlinkedHeader.style.color = 'var(--text-muted)';
			unlinkedHeader.createSpan({ text: `📝 Unlinked mentions (${unlinkedMentions.length})` });
			
			const unlinkedList = unlinkedSection.createDiv('backlinks-items');
			this.renderBacklinkItems(unlinkedList, unlinkedMentions);
		}
	}

	renderBacklinkItems(container: HTMLElement, backlinks: Array<{ file: TFile; isLinked: boolean }>) {
		backlinks.forEach(backlinkItem => {
			const backlinkFile = backlinkItem.file;
			const item = container.createDiv('backlink-item');
			item.style.padding = '8px 10px';
			item.style.cursor = 'pointer';
			item.style.borderRadius = '4px';
			item.style.marginBottom = '2px';

			// Visual distinction for unlinked mentions
			if (!backlinkItem.isLinked) {
				item.style.opacity = '0.85';
				item.style.fontStyle = 'italic';
			}

			item.addEventListener('mouseenter', () => {
				item.style.backgroundColor = 'var(--background-modifier-hover)';
			});
			item.addEventListener('mouseleave', () => {
				item.style.backgroundColor = '';
			});

			const title = item.createDiv('backlink-title');
			title.setText(backlinkFile.basename);
			title.style.fontWeight = '500';

			const path = item.createDiv('backlink-path');
			path.setText(backlinkFile.path);
			path.style.fontSize = '0.85em';
			path.style.color = 'var(--text-muted)';

			// Click to open in Search Tab (or Cmd+Click to open in new tab)
			item.addEventListener('click', async (evt: MouseEvent) => {
				// Check if Cmd/Ctrl key is pressed
				if (evt.metaKey || evt.ctrlKey) {
					// Open in new tab
					evt.preventDefault();
					evt.stopPropagation();
					
					const newLeaf = this.app.workspace.getLeaf('tab');
					await newLeaf.openFile(backlinkFile);
				} else {
					// Navigate to this file in Search Tab
					evt.preventDefault();
					evt.stopPropagation();
					
					if (this.plugin.searchTabView) {
						// Find the index of this backlink file in the current results
						const index = this.plugin.searchResultsCache.findIndex(f => f.path === backlinkFile.path);
						if (index >= 0) {
							// Set the index and highlight
							await this.plugin.setIndexAndHighlight(index);
						} else {
							// File not in current results, just display it
							await this.plugin.searchTabView.displayFile(backlinkFile);
						}
					} else {
						// If Search Tab isn't open, open the file normally
						await this.app.workspace.getLeaf(false).openFile(backlinkFile);
					}
				}
			});
		});
	}

	async onClose() {
		this.targetFile = null;
		if (this.plugin.searchTabBacklinksView === this) {
			this.plugin.searchTabBacklinksView = null;
		}
	}
}

export default class SearchShortlistPlugin extends Plugin {
	searchResultsCache: TFile[] = [];
	resultElements: HTMLElement[] = [];
	selectedIndex: number = -1;
	searchTabView: SearchTabView | null = null;
	searchTabBacklinksView: SearchTabBacklinksView | null = null;
	highlightedElement: HTMLElement | null = null;
	currentMode: 'search' | 'backlinks' = 'search';

	// Track state per mode
	searchModeIndex: number = -1;
	backlinksModeIndex: number = -1;
	lastSearchHash: string = '';
	lastBacklinksHash: string = '';

	async onload() {
		console.log('Loading Search Tab Plugin');

		// Register the Search Tab view
		this.registerView(
			SEARCH_TAB_VIEW_TYPE,
			(leaf) => {
				const view = new SearchTabView(leaf, this);
				this.searchTabView = view;
				return view;
			}
		);

		// Register the Search Tab Backlinks view
		this.registerView(
			SEARCH_TAB_BACKLINKS_VIEW_TYPE,
			(leaf) => {
				const view = new SearchTabBacklinksView(leaf, this);
				this.searchTabBacklinksView = view;
				return view;
			}
		);

		// Watch for search/backlinks updates
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.updateSearchResults();
			})
		);

		// Add DOM event handler for Cmd+Enter in input fields (like search bar)
		this.registerDomEvent(document, 'keydown', async (evt: KeyboardEvent) => {
			// Only handle Cmd/Ctrl+Enter
			if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
				// Check if we're in an input or textarea (like the search bar)
				const target = evt.target as HTMLElement;
				if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
					// Only prevent default and handle if we have results
					if (this.searchResultsCache.length > 0) {
						// If no result selected yet, select the first one and display it
						if (this.selectedIndex < 0) {
							await this.setIndexAndHighlight(0);
						}
						evt.preventDefault();
						evt.stopPropagation();
						await this.openInNewTab(false);
					}
				}
			}
		});

		// Command to open Search Tab
		this.addCommand({
			id: 'open-search-tab',
			name: 'Open Search Tab',
			callback: () => {
				this.activateSearchTab();
			}
		});

		this.addCommand({
			id: 'navigate-next',
			name: 'Navigate to next result',
			hotkeys: [{ modifiers: ["Mod"], key: "ArrowDown" }],
			callback: async () => {
				await this.navigate(1);
			}
		});

		this.addCommand({
			id: 'navigate-previous',
			name: 'Navigate to previous result',
			hotkeys: [{ modifiers: ["Mod"], key: "ArrowUp" }],
			callback: async () => {
				await this.navigate(-1);
			}
		});

		this.addCommand({
			id: 'open-in-new-tab',
			name: 'Open current result in new tab (keep focus)',
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
			checkCallback: (checking: boolean) => {
				// Always allow the command to run
				if (!checking) {
					this.openInNewTab(false);
				}
				return true;
			}
		});

		this.addCommand({
			id: 'open-in-new-tab-and-focus',
			name: 'Open current result in new tab (switch focus)',
			checkCallback: (checking: boolean) => {
				// Always allow the command to run
				if (!checking) {
					this.openInNewTab(true);
				}
				return true;
			}
		});

		this.addCommand({
			id: 'switch-to-search-mode',
			name: 'Switch to Search mode',
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "s" }],
			callback: () => {
				if (this.searchTabView) {
					this.searchTabView.setMode('search');
				}
			}
		});

		this.addCommand({
			id: 'switch-to-backlinks-mode',
			name: 'Switch to Backlinks mode',
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "b" }],
			callback: () => {
				if (this.searchTabView) {
					this.searchTabView.setMode('backlinks');
				}
			}
		});

		// Command to open Search Tab Backlinks panel
		this.addCommand({
			id: 'open-search-tab-backlinks',
			name: 'Open Search Tab Backlinks',
			callback: () => {
				this.activateSearchTabBacklinks();
			}
		});

		// Command to sync native backlinks panel to Search Tab file
		this.addCommand({
			id: 'sync-backlinks-to-search-tab',
			name: 'Sync backlinks to Search Tab file',
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "l" }],
			checkCallback: (checking: boolean) => {
				// Only enable if Search Tab is open and has a file
				const hasFile = this.searchTabView && this.searchTabView.currentFile;
				if (checking) {
					return !!hasFile;
				}

				if (hasFile) {
					this.syncBacklinksToSearchTabFile();
				}
				return true;
			}
		});

		console.log('Search Tab Plugin loaded');
	}

	async activateSearchTab() {
		const { workspace } = this.app;

		// Check if view is already open
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(SEARCH_TAB_VIEW_TYPE);
		const isNewView = leaves.length === 0;

		if (leaves.length > 0) {
			// View already exists, just reveal it
			leaf = leaves[0];
			// Update the plugin reference to this view
			const view = leaf.view as SearchTabView;
			if (view) {
				this.searchTabView = view;
			}
		} else {
			// Create new tab in main editor area
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({
				type: SEARCH_TAB_VIEW_TYPE,
				active: true
			});
			// The registerView callback will set this.searchTabView
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}

		// Auto-open first result when Search Tab is first created
		if (isNewView) {
			setTimeout(() => {
				this.updateSearchResults();
				// Navigate to first result
				if (this.searchResultsCache.length > 0) {
					this.navigate(1); // This will go from -1 to 0
				}
			}, 100);
		}
	}

	async activateSearchTabBacklinks() {
		const { workspace } = this.app;

		// Check if view is already open
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(SEARCH_TAB_BACKLINKS_VIEW_TYPE);

		if (leaves.length > 0) {
			// View already exists, just reveal it
			leaf = leaves[0];
			// Update the plugin reference to this view
			const view = leaf.view as SearchTabBacklinksView;
			if (view) {
				this.searchTabBacklinksView = view;
			}
		} else {
			// Create new leaf in right sidebar
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: SEARCH_TAB_BACKLINKS_VIEW_TYPE,
					active: true
				});
			}
			// The registerView callback will set this.searchTabBacklinksView
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async syncBacklinksToSearchTabFile() {
		// Get the current file from Search Tab
		if (this.searchTabView && this.searchTabView.currentFile) {
			const currentFile = this.searchTabView.currentFile;

			// Open the file in a regular leaf so the native backlinks panel updates
			// Check if there's already a leaf with this file open (excluding Search Tab's embedded leaf)
			const existingLeaf = this.findLeafWithFile(currentFile);

			if (existingLeaf) {
				// File is already open, just make it active
				this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
			} else {
				// Open in a new tab
				const newLeaf = this.app.workspace.getLeaf('tab');
				await newLeaf.openFile(currentFile);
				this.app.workspace.setActiveLeaf(newLeaf, { focus: true });
			}
		}
	}

	getSearchView(): View | null {
		const leaves = this.app.workspace.getLeavesOfType('search');
		if (leaves.length > 0) {
			return leaves[0].view;
		}
		return null;
	}

	getBacklinksView(): View | null {
		const leaves = this.app.workspace.getLeavesOfType('backlink');
		if (leaves.length > 0) {
			return leaves[0].view;
		}
		return null;
	}

	getResultsHash(results: TFile[]): string {
		// Create a hash of the file paths to detect changes
		return results.map(f => f.path).join('|');
	}

	updateSearchResults() {
		let results: TFile[] = [];
		let elements: HTMLElement[] = [];

		// Use the current mode from Search Tab view
		if (this.currentMode === 'search') {
			const searchView = this.getSearchView();
			if (searchView) {
				const extracted = this.extractSearchResults(searchView);
				results = extracted.files;
				elements = extracted.elements;
			}
		} else if (this.currentMode === 'backlinks') {
			const backlinksView = this.getBacklinksView();
			if (backlinksView) {
				const extracted = this.extractBacklinksResults(backlinksView);
				results = extracted.files;
				elements = extracted.elements;
			}
		}

		// Compute hash to detect if results changed
		const currentHash = this.getResultsHash(results);
		const previousHash = this.currentMode === 'search' ? this.lastSearchHash : this.lastBacklinksHash;
		const resultsChanged = currentHash !== previousHash;

		// Update hash
		if (this.currentMode === 'search') {
			this.lastSearchHash = currentHash;
		} else {
			this.lastBacklinksHash = currentHash;
		}

		// Clear all highlights before updating (to prevent duplicates when elements are cloned)
		this.clearAllHighlights();

		this.searchResultsCache = results;
		this.resultElements = elements;

		if (resultsChanged) {
			// Results changed - reset to 0 (ready for first Cmd+Down to go to index 0)
			this.selectedIndex = -1;
			if (this.currentMode === 'search') {
				this.searchModeIndex = -1;
			} else {
				this.backlinksModeIndex = -1;
			}
		} else {
			// Results didn't change - restore the saved index for this mode
			if (this.currentMode === 'search') {
				this.selectedIndex = this.searchModeIndex;
			} else {
				this.selectedIndex = this.backlinksModeIndex;
			}

			// Clamp to valid range
			if (this.selectedIndex >= results.length) {
				this.selectedIndex = Math.max(0, results.length - 1);
			}
		}

		// Attach click handlers to result elements
		this.attachClickHandlersToResults();

		// Re-highlight the current selection if there is one
		if (this.selectedIndex >= 0 && this.resultElements[this.selectedIndex]) {
			this.highlightElement(this.resultElements[this.selectedIndex]);
		}
	}

	attachClickHandlersToResults() {
		// Attach click handlers to each result element
		this.resultElements.forEach((element, index) => {
			// Check if we've already attached a handler to this element
			if ((element as any).__searchTabHandlerAttached) {
				return;
			}

			// Mark this element as having a handler
			(element as any).__searchTabHandlerAttached = true;

			// Add click handler
			element.addEventListener('click', async (evt: MouseEvent) => {
				// Check if Cmd/Ctrl key is pressed
				if (evt.metaKey || evt.ctrlKey) {
					// Open in new tab
					evt.preventDefault();
					evt.stopPropagation();
					
					// Find the current index (in case the array has changed)
					const currentIndex = this.resultElements.indexOf(element);
					const file = this.searchResultsCache[currentIndex];
					if (file) {
						const newLeaf = this.app.workspace.getLeaf('tab');
						await newLeaf.openFile(file);
					}
				} else {
					// Navigate to this result in Search Tab
					evt.preventDefault();
					evt.stopPropagation();
					
					// Find the current index (in case the array has changed)
					const currentIndex = this.resultElements.indexOf(element);
					if (currentIndex >= 0) {
						await this.setIndexAndHighlight(currentIndex);
					}
				}
			});
		});
	}

	extractSearchResults(searchView: View): { files: TFile[], elements: HTMLElement[] } {
		const files: TFile[] = [];
		const elements: HTMLElement[] = [];

		// Access the search results through the view's DOM
		const searchResultsEl = searchView.containerEl.querySelector('.search-results-children');
		if (!searchResultsEl) {
			return { files, elements };
		}

		// Find all result items
		const resultItems = searchResultsEl.querySelectorAll('.tree-item-self');
		resultItems.forEach((item: Element) => {
			const titleEl = item.querySelector('.tree-item-inner');
			if (titleEl) {
				const fileName = titleEl.textContent?.trim();
				if (fileName) {
					// Find the file in the vault
					const file = this.app.vault.getMarkdownFiles().find(f =>
						f.basename === fileName || f.path.endsWith(fileName)
					);
					if (file) {
						files.push(file);
						elements.push(item as HTMLElement);
					}
				}
			}
		});

		return { files, elements };
	}

	async getBacklinksForFile(targetFile: TFile): Promise<Array<{ file: TFile; isLinked: boolean }>> {
		// Use MetadataCache to get linked mentions
		const backlinks: Array<{ file: TFile; isLinked: boolean }> = [];
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const seenFiles = new Set<string>();

		// Get linked mentions (explicit links using [[ ]])
		for (const sourcePath in resolvedLinks) {
			const links = resolvedLinks[sourcePath];
			// Check if this file links to our target
			if (links[targetFile.path]) {
				const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
				if (sourceFile instanceof TFile) {
					backlinks.push({ file: sourceFile, isLinked: true });
					seenFiles.add(sourceFile.path);
				}
			}
		}

		// Get unlinked mentions (text mentions of the file name without [[ ]])
		// We need to search file contents for the target file's basename
		const targetBasename = targetFile.basename;
		const allFiles = this.app.vault.getMarkdownFiles();
		
		for (const file of allFiles) {
			// Skip if already counted as linked mention
			if (seenFiles.has(file.path)) {
				continue;
			}
			
			// Skip the target file itself
			if (file.path === targetFile.path) {
				continue;
			}
			
			try {
				const content = await this.app.vault.cachedRead(file);
				// Simple check: does the content contain the basename as a word?
				// Use word boundaries to avoid partial matches
				const regex = new RegExp(`\\b${targetBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
				if (regex.test(content)) {
					backlinks.push({ file: file, isLinked: false });
					seenFiles.add(file.path);
				}
			} catch (e) {
				// Ignore files we can't read
			}
		}

		return backlinks;
	}

	extractBacklinksResults(backlinksView: View): { files: TFile[], elements: HTMLElement[] } {
		const files: TFile[] = [];
		const elements: HTMLElement[] = [];

		// Access the backlinks through the view's DOM
		const backlinksContainer = backlinksView.containerEl.querySelector('.backlink-pane');
		if (!backlinksContainer) {
			return { files, elements };
		}

		// Find all backlink file items (they have class search-result-file-title)
		const resultItems = backlinksContainer.querySelectorAll('.search-result-file-title');
		resultItems.forEach((item: Element) => {
			const titleEl = item.querySelector('.tree-item-inner');
			if (titleEl) {
				const fileName = titleEl.textContent?.trim();
				if (fileName) {
					// Find the file in the vault
					const file = this.app.vault.getMarkdownFiles().find(f =>
						f.basename === fileName || f.path.endsWith(fileName)
					);
					if (file) {
						files.push(file);
						elements.push(item as HTMLElement);
					}
				}
			}
		});

		return { files, elements };
	}

	clearHighlight() {
		if (this.highlightedElement) {
			this.highlightedElement.style.backgroundColor = '';
			this.highlightedElement.style.outline = '';
			this.highlightedElement.style.outlineOffset = '';
			this.highlightedElement = null;
		}
	}

	clearAllHighlights() {
		// Clear highlights on all result elements (used when refreshing the list)
		this.resultElements.forEach(element => {
			if (element) {
				element.style.backgroundColor = '';
				element.style.outline = '';
				element.style.outlineOffset = '';
			}
		});
		this.highlightedElement = null;
	}

	highlightElement(element: HTMLElement) {
		// Clear previous highlight
		this.clearHighlight();

		// Add highlight
		element.style.backgroundColor = 'var(--background-modifier-hover)';
		element.style.outline = '2px solid var(--interactive-accent)';
		element.style.outlineOffset = '-2px';
		this.highlightedElement = element;

		// Scroll into view
		element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	async setIndexAndHighlight(index: number) {
		// Update results cache first
		this.updateSearchResults();

		if (this.searchResultsCache.length === 0) {
			return;
		}

		// Clamp index to valid range
		this.selectedIndex = Math.max(0, Math.min(index, this.searchResultsCache.length - 1));

		// Update mode-specific index
		if (this.currentMode === 'search') {
			this.searchModeIndex = this.selectedIndex;
		} else {
			this.backlinksModeIndex = this.selectedIndex;
		}

		// Highlight the element
		if (this.resultElements.length > this.selectedIndex) {
			this.highlightElement(this.resultElements[this.selectedIndex]);
		}

		// Display the file
		const currentFile = this.searchResultsCache[this.selectedIndex];
		if (currentFile) {
			await this.updatePreview(currentFile);
		}
	}

	async navigate(direction: number) {
		// Update results cache
		this.updateSearchResults();

		if (this.searchResultsCache.length === 0) {
			console.log('No search results found');
			return;
		}

		// Navigate from current position
		this.selectedIndex += direction;

		// Wrap around
		if (this.selectedIndex < 0) {
			this.selectedIndex = this.searchResultsCache.length - 1;
		} else if (this.selectedIndex >= this.searchResultsCache.length) {
			this.selectedIndex = 0;
		}

		// Save the index for the current mode
		if (this.currentMode === 'search') {
			this.searchModeIndex = this.selectedIndex;
		} else {
			this.backlinksModeIndex = this.selectedIndex;
		}

		const currentFile = this.searchResultsCache[this.selectedIndex];
		if (!currentFile) {
			console.log('No file found at index', this.selectedIndex);
			return;
		}

		// Highlight the selected element
		if (this.resultElements[this.selectedIndex]) {
			this.highlightElement(this.resultElements[this.selectedIndex]);
		}

		await this.updatePreview(currentFile);

		console.log(`Navigated to result ${this.selectedIndex + 1}/${this.searchResultsCache.length}: ${currentFile.basename}`);
	}

	async updatePreview(file: TFile) {
		// Update the Search Tab view if it's open
		if (this.searchTabView) {
			await this.searchTabView.displayFile(file);
		}
	}

	async openInNewTab(switchFocus: boolean = false) {
		this.updateSearchResults();

		console.log('openInNewTab called', {
			cacheLength: this.searchResultsCache.length,
			selectedIndex: this.selectedIndex,
			currentMode: this.currentMode,
			switchFocus
		});

		if (this.searchResultsCache.length === 0) {
			console.log('No search results available');
			return;
		}

		const currentFile = this.searchResultsCache[this.selectedIndex];
		if (!currentFile) {
			console.log('No file selected at index', this.selectedIndex);
			return;
		}

		console.log('Opening file:', currentFile.basename);

		if (switchFocus) {
			// Switch focus mode: check for existing tab first
			const existingLeaf = this.findLeafWithFile(currentFile);

			if (existingLeaf) {
				// File is already open, switch to it
				console.log(`File ${currentFile.basename} already open, switching to existing tab`);
				this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
			} else {
				// Open in a brand new tab and switch to it
				const newLeaf = this.app.workspace.getLeaf('tab');
				await newLeaf.openFile(currentFile);
				console.log(`Opened ${currentFile.basename} in new tab and switched focus`);
			}
		} else {
			// Keep focus mode: always create a new tab (even if duplicate)
			const newLeaf = this.app.workspace.getLeaf('tab');
			await newLeaf.openFile(currentFile);
			console.log(`Opened ${currentFile.basename} in new tab`);

			// Return focus to Search Tab
			if (this.searchTabView) {
				const searchTabLeaves = this.app.workspace.getLeavesOfType(SEARCH_TAB_VIEW_TYPE);
				if (searchTabLeaves.length > 0) {
					this.app.workspace.setActiveLeaf(searchTabLeaves[0], { focus: true });
				}
			}
		}
	}

	findLeafWithFile(file: TFile): WorkspaceLeaf | null {
		// Find all markdown leaves
		const leaves = this.app.workspace.getLeavesOfType('markdown');

		for (const leaf of leaves) {
			const view = leaf.view as MarkdownView;

			// Skip the embedded leaf used in Search Tab
			if (this.searchTabView?.embeddedLeaf && leaf === this.searchTabView.embeddedLeaf) {
				continue;
			}

			// Also skip if this leaf's parent is hidden (additional check for embedded leaf)
			const parent = (leaf as any).parent;
			if (parent && parent.containerEl) {
				const parentEl = parent.containerEl;
				// Check if parent is hidden (characteristic of embedded leaf)
				if (parentEl.style.display === 'none' ||
					parentEl.style.left === '-10000px' ||
					parseInt(parentEl.style.width) === 0) {
					continue;
				}
			}

			// Check if this leaf has the same file
			if (view.file && view.file.path === file.path) {
				return leaf;
			}
		}

		return null;
	}

	onunload() {
		console.log('Unloading Search Tab Plugin');
	}
}
