import { Plugin, TFile, WorkspaceLeaf, MarkdownView, View, ItemView, Workspace, MarkdownRenderer } from 'obsidian';

type ViewType = 'search' | 'backlinks' | null;

const NAVIGATION_VIEW_TYPE = 'search-shortlist-navigation';

class NavigationView extends ItemView {
	public plugin: SearchShortlistPlugin;
	public mode: 'search' | 'backlinks' = 'search';
	private targetFile: TFile | null = null;
	private searchBtn: HTMLButtonElement | null = null;
	private backlinksBtn: HTMLButtonElement | null = null;
	private embeddedLeaf: WorkspaceLeaf | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: SearchShortlistPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return NAVIGATION_VIEW_TYPE;
	}

	getDisplayText(): string {
		if (this.mode === 'backlinks' && this.targetFile) {
			return `Backlinks: ${this.targetFile.basename}`;
		}
		return 'Search Tab';
	}

	getIcon(): string {
		return 'search';
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass('search-shortlist-navigation');
		
		// Create compact header matching Obsidian's native style
		const header = this.contentEl.createDiv('nav-header');
		header.style.position = 'sticky';
		header.style.top = '0';
		header.style.zIndex = '101';
		header.style.background = 'var(--background-primary)';
		header.style.padding = '4px 8px';
		header.style.marginBottom = '0';
		header.style.borderBottom = '1px solid var(--background-modifier-border)';
		header.style.display = 'flex';
		header.style.alignItems = 'center';
		header.style.gap = '6px';
		header.style.minHeight = '28px';
		header.style.height = '28px';
		
		// Mode selector as compact icon buttons (like Obsidian's native buttons)
		const modeContainer = header.createDiv('mode-selector');
		modeContainer.style.display = 'flex';
		modeContainer.style.gap = '2px';
		modeContainer.style.alignItems = 'center';
		modeContainer.style.marginRight = 'auto';
		
		this.searchBtn = modeContainer.createEl('button', { 
			text: '🔍', 
			cls: 'mode-btn-icon',
			attr: { 'aria-label': 'Search mode', 'title': 'Search mode' }
		});
		this.backlinksBtn = modeContainer.createEl('button', { 
			text: '🔗', 
			cls: 'mode-btn-icon',
			attr: { 'aria-label': 'Backlinks mode', 'title': 'Backlinks mode' }
		});
		
		this.searchBtn.addEventListener('click', () => {
			this.setMode('search');
			this.plugin.setViewType('search');
		});
		
		this.backlinksBtn.addEventListener('click', async () => {
			// When switching to backlinks, try to get the current file
			const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeLeaf && activeLeaf.file) {
				this.setMode('backlinks', activeLeaf.file);
				this.plugin.setViewType('backlinks', activeLeaf.file);
				
				// Try to open backlinks view if it doesn't exist
				const backlinksView = this.plugin.getBacklinksView();
				if (!backlinksView) {
					// Open backlinks for the current file
					// Try to open backlinks pane
					const backlinksLeaf = this.plugin.app.workspace.getLeavesOfType('backlink');
					if (backlinksLeaf.length === 0) {
						// Create a new backlinks leaf
						const newLeaf = this.plugin.app.workspace.getLeaf('split', 'vertical');
						await newLeaf.setViewState({
							type: 'backlink',
							state: { file: activeLeaf.file.path }
						});
					}
				}
			} else {
				this.setMode('backlinks');
				this.plugin.setViewType('backlinks');
			}
		});
		
		// Update button states
		this.updateButtonStates();
		
		// Results container
		this.contentEl.createDiv('nav-results');
		
		this.updateDisplay();
	}

	setMode(mode: 'search' | 'backlinks', targetFile?: TFile) {
		this.mode = mode;
		if (targetFile) {
			this.targetFile = targetFile;
		}
		this.updateButtonStates();
		this.updateDisplay();
	}

	updateButtonStates() {
		if (this.searchBtn && this.backlinksBtn) {
			if (this.mode === 'search') {
				this.searchBtn.addClass('active');
				this.backlinksBtn.removeClass('active');
			} else {
				this.searchBtn.removeClass('active');
				this.backlinksBtn.addClass('active');
			}
		}
	}
	
	// Auto-select first result when results are available
	autoSelectFirst() {
		if (this.plugin.resultsCache.length > 0 && this.plugin.selectedIndex === 0 && !this.plugin.currentFile) {
			// Automatically select and display the first result
			// Only if Navigation View is active to avoid opening new tabs
			if (this.plugin.navigationView && this.plugin.navigationLeaf) {
				const isActive = this.plugin.app.workspace.getActiveViewOfType(NavigationView) === this;
				if (isActive) {
					this.plugin.currentFile = this.plugin.resultsCache[0];
					this.plugin.updatePreview(this.plugin.resultsCache[0], this.plugin.currentViewType || 'search');
					this.updateDisplay();
				}
			}
		}
	}

	updateDisplay() {
		// Auto-select first result if available
		this.autoSelectFirst();
		
		const resultsContainer = this.contentEl.querySelector('.nav-results') as HTMLElement;
		if (!resultsContainer) return;
		
		resultsContainer.empty();
		
		// Show current file content if available
		const currentFile = this.plugin.getCurrentFile();
		if (currentFile) {
			this.displayFileContent(resultsContainer, currentFile);
		} else {
			// Show instructions
			if (this.mode === 'search') {
				resultsContainer.createEl('p', { 
					text: 'Open search (Ctrl/Cmd+Shift+F) and use Ctrl/Cmd+↑↓ to navigate',
					cls: 'nav-instructions'
				});
			} else {
				if (this.targetFile) {
					resultsContainer.createEl('p', { 
						text: `Use Ctrl/Cmd+↑↓ to navigate backlinks, Ctrl/Cmd+Enter to open in new tab`,
						cls: 'nav-instructions'
					});
				} else {
					resultsContainer.createEl('p', { 
						text: 'Click on a note to view its backlinks here',
						cls: 'nav-instructions'
					});
				}
			}
		}
	}

	async displayFileContent(container: HTMLElement, file: TFile) {
		container.empty();
		
		// Create sticky file title header at the top
		const fileHeader = container.createDiv('nav-file-header');
		fileHeader.style.position = 'sticky';
		fileHeader.style.top = '0';
		fileHeader.style.zIndex = '100';
		fileHeader.style.padding = '12px';
		fileHeader.style.borderBottom = '2px solid var(--background-modifier-border)';
		fileHeader.style.background = 'var(--background-primary)';
		fileHeader.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
		fileHeader.style.marginBottom = '10px';
		fileHeader.style.marginTop = '0';
		
		const fileName = fileHeader.createEl('h4', { text: file.basename });
		fileName.style.margin = '0';
		fileName.style.fontSize = '16px';
		fileName.style.fontWeight = '600';
		fileName.style.color = 'var(--text-normal)';
		
		// Show file path as subtitle
		const filePath = fileHeader.createEl('div', { text: file.path });
		filePath.style.fontSize = '11px';
		filePath.style.color = 'var(--text-muted)';
		filePath.style.marginTop = '4px';
		
		// Show context if in backlinks mode
		if (this.mode === 'backlinks' && this.targetFile) {
			const contextInfo = fileHeader.createEl('div', { 
				text: `Backlinks for: ${this.targetFile.basename}`,
				cls: 'nav-context-info'
			});
			contextInfo.style.fontSize = '11px';
			contextInfo.style.color = 'var(--text-muted)';
			contextInfo.style.marginTop = '4px';
			contextInfo.style.fontStyle = 'italic';
		}
		
		// Create content area that will hold the embedded note view
		const contentArea = container.createDiv('nav-file-content');
		contentArea.style.flex = '1';
		contentArea.style.display = 'flex';
		contentArea.style.flexDirection = 'column';
		contentArea.style.overflow = 'hidden';
		contentArea.style.minHeight = '400px';
		
		// Use the plugin's preview leaf and display it here
		try {
			// Get or create the preview leaf
			if (!this.plugin.previewLeaf || !this.plugin.previewLeaf.view) {
				// Use 'split' to avoid creating a visible tab
				this.plugin.previewLeaf = this.plugin.app.workspace.getLeaf('split');
			}
			
			// Open the file in the preview leaf (but don't activate it)
			await this.plugin.previewLeaf.openFile(file, { active: false });
			
			// Get the markdown view
			const markdownView = this.plugin.previewLeaf.view as MarkdownView;
			if (markdownView) {
				// Get the view's content element
				const viewContent = markdownView.contentEl;
				viewContent.style.height = '100%';
				viewContent.style.flex = '1';
				
				// Move the view content into our container
				contentArea.appendChild(viewContent);
				
				// Set edit mode by default
				if (markdownView.getMode() === 'preview') {
					// Force to source/edit mode
					(markdownView as any).setMode?.('source');
				}
				
				// Store reference
				this.embeddedLeaf = this.plugin.previewLeaf;
			}
		} catch (error) {
			// Fallback: create a simple text display
			console.error('Error creating embedded view:', error);
			contentArea.createEl('p', { 
				text: `Error displaying file: ${error}`,
				cls: 'nav-error'
			});
		}
	}
	
	async onClose() {
		// Don't detach the preview leaf - it's shared with the plugin
		// Just clean up our reference
		this.embeddedLeaf = null;
		this.contentEl.empty();
	}
}

export default class SearchShortlistPlugin extends Plugin {
	public resultsCache: TFile[] = [];
	private resultElements: HTMLElement[] = []; // Store DOM elements for highlighting
	public selectedIndex: number = 0;
	public previewLeaf: WorkspaceLeaf | null = null;
	public navigationLeaf: WorkspaceLeaf | null = null;
	public navigationView: NavigationView | null = null;
	public currentViewType: ViewType = null;
	private originalBacklinksFile: TFile | null = null; // Track which file's backlinks we're viewing
	private highlightedElement: HTMLElement | null = null; // Track currently highlighted element
	public currentFile: TFile | null = null; // Current file being displayed

	getCurrentFile(): TFile | null {
		return this.currentFile;
	}

	setViewType(viewType: ViewType, targetFile?: TFile) {
		this.currentViewType = viewType;
		if (viewType === 'backlinks' && targetFile) {
			this.originalBacklinksFile = targetFile;
		}
		// Update results when switching modes
		this.updateResults();
	}

	async onload() {
		console.log('🔍 Loading Search Tab Plugin');
		
		// Register the navigation view
		this.registerView(NAVIGATION_VIEW_TYPE, (leaf) => {
			this.navigationView = new NavigationView(leaf, this);
			this.navigationLeaf = leaf;
			return this.navigationView;
		});
		
		// Add command to open search tab
		this.addCommand({
			id: 'open-search-tab',
			name: 'Open Search Tab',
			callback: () => {
				this.activateNavigationView();
			}
		});
		
		// Search Tab commands (names don't include "Search Tab:" prefix - Obsidian adds plugin name automatically)
		this.addCommand({
			id: 'navigate-next',
			name: 'Navigate to Next Result',
			callback: async () => {
				if (this.navigationView && this.navigationLeaf) {
					const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
					if (isActive) {
						await this.navigate(1, this.currentViewType || 'search');
					}
				}
			}
		});
		
		this.addCommand({
			id: 'navigate-previous',
			name: 'Navigate to Previous Result',
			callback: async () => {
				if (this.navigationView && this.navigationLeaf) {
					const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
					if (isActive) {
						await this.navigate(-1, this.currentViewType || 'search');
					}
				}
			}
		});
		
		this.addCommand({
			id: 'open-new-tab-keep-focus',
			name: 'Open Current Result in New Tab (Keep Focus)',
			callback: async () => {
				if (this.navigationView && this.navigationLeaf) {
					const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
					if (isActive) {
						await this.openInNewTab(this.currentViewType || 'search');
					}
				}
			}
		});
		
		this.addCommand({
			id: 'open-new-tab-switch-focus',
			name: 'Open Current Result in New Tab (Switch Focus)',
			callback: async () => {
				if (this.navigationView && this.navigationLeaf) {
					const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
					if (isActive) {
						await this.openInNewTabAndFocus(this.currentViewType || 'search');
					}
				}
			}
		});
		
		this.addCommand({
			id: 'open-split-pane',
			name: 'Open Current Result in Split Pane',
			callback: async () => {
				if (this.navigationView && this.navigationLeaf) {
					const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
					if (isActive) {
						await this.openToSide(this.currentViewType || 'search');
					}
				}
			}
		});
		
		this.addCommand({
			id: 'switch-to-search-mode',
			name: 'Switch to Search Mode',
			callback: () => {
				if (this.navigationView) {
					this.navigationView.setMode('search');
					this.setViewType('search');
				}
			}
		});
		
		this.addCommand({
			id: 'switch-to-backlinks-mode',
			name: 'Switch to Backlinks Mode',
			callback: async () => {
				if (this.navigationView) {
					const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (activeLeaf && activeLeaf.file) {
						this.navigationView.setMode('backlinks', activeLeaf.file);
						this.setViewType('backlinks', activeLeaf.file);
					} else {
						this.navigationView.setMode('backlinks');
						this.setViewType('backlinks');
					}
				}
			}
		});
		
		// Try to restore navigation view if it was open
		this.app.workspace.onLayoutReady(() => {
			const leaves = this.app.workspace.getLeavesOfType(NAVIGATION_VIEW_TYPE);
			if (leaves.length > 0) {
				this.navigationLeaf = leaves[0];
				this.navigationView = leaves[0].view as unknown as NavigationView;
			}
		});

		// Register keyboard event handler for search and backlinks panels
		this.registerDomEvent(document, 'keydown', async (evt: KeyboardEvent) => {
			try {
				// Only handle Ctrl/Cmd+arrow keys and Ctrl/Cmd+Enter
				// Regular arrows should work for editing the note
				const isCtrlArrow = (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') && (evt.ctrlKey || evt.metaKey);
				const isCtrlEnter = evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey);
				
				if (!isCtrlArrow && !isCtrlEnter) {
					return;
				}
				
				// Check for search view first
			const searchView = this.getSearchView();
				const backlinksView = this.getBacklinksView();

				let activeView: View | null = null;
				let viewType: ViewType = null;

			const activeElement = document.activeElement;
			
				// Check if search view exists and has results
				if (searchView) {
					const searchContainer = searchView.containerEl;
					if (searchContainer) {
						// Check if focus is in search, or if search results are visible
						const hasFocus = searchContainer.contains(activeElement);
						const hasResults = searchContainer.querySelector('.tree-item-self, .tree-item');
						
						if (hasFocus || hasResults) {
							activeView = searchView;
							viewType = 'search';
							console.log('🔍 Search view detected', { hasFocus, hasResults: !!hasResults });
						}
					}
				}
				
				// Check if backlinks view exists and has results
				if (!activeView && backlinksView) {
					const backlinksContainer = backlinksView.containerEl;
					if (backlinksContainer) {
						// Check if focus is in backlinks, or if backlinks are visible
						const hasFocus = backlinksContainer.contains(activeElement);
						const hasResults = backlinksContainer.querySelector('.tree-item-self, .tree-item');
						
						if (hasFocus || hasResults) {
							activeView = backlinksView;
							viewType = 'backlinks';
							console.log('🔗 Backlinks view detected', { hasFocus, hasResults: !!hasResults });
						}
					}
				}
				
				// Only handle if Navigation View is active AND we have search/backlinks
				const isNavigationViewActive = this.navigationLeaf && 
					this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
				
				if (!isNavigationViewActive) {
					// Only allow navigation when Navigation View is active
					return;
				}
				
				// If Navigation View is active, check the mode and allow navigation
				if (this.navigationView) {
					const navMode = this.navigationView.mode;
					if (navMode === 'backlinks' && this.currentViewType === 'backlinks') {
						// In backlinks mode, allow navigation if we have cached results
						if (this.resultsCache.length > 0) {
							viewType = 'backlinks';
							// Don't require activeView for backlinks if we have cached results
							if (!activeView) {
								activeView = backlinksView || null;
							}
						}
					} else if (navMode === 'search' && !viewType) {
						// In search mode, require search view
						if (searchView) {
							viewType = 'search';
							activeView = searchView;
						}
					}
				}
				
				// Only handle if we have an active view or cached results for backlinks
				if (!viewType || (!activeView && this.resultsCache.length === 0)) {
					// Debug: log when we have arrow keys but no view
					if (isCtrlArrow) {
						console.log('⚠️ Ctrl/Cmd+Arrow pressed but no active search/backlinks view found');
						console.log('   Search view exists:', !!searchView);
						console.log('   Backlinks view exists:', !!backlinksView);
						console.log('   Navigation View mode:', this.navigationView?.mode);
						console.log('   Cached results:', this.resultsCache.length);
					}
					return;
				}
				
				// Don't interfere if user is typing in a textarea or input
				// We'll check this more carefully in the individual handlers
				if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
					// Only allow Ctrl/Cmd+arrows if we're in the Navigation View's content
					if (isCtrlArrow && this.navigationView && this.navigationView.contentEl.contains(activeElement)) {
						// Allow it - we'll check more carefully in the handler
					} else {
						return;
					}
				}
				
				this.currentViewType = viewType;
				
				// Handle Ctrl/Cmd+arrow down (navigate to next note)
				// Only handle if Navigation View is active and we're not in a text input
				if (evt.key === 'ArrowDown' && (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && !evt.altKey) {
					// Check if we're in a text input - if so, don't interfere
					const target = evt.target as HTMLElement;
					if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
						return; // Let the browser handle it
					}
					evt.preventDefault();
					evt.stopPropagation();
					evt.stopImmediatePropagation();
					await this.navigate(1, viewType);
					return;
				}
				
				// Handle Ctrl/Cmd+arrow up (navigate to previous note)
				// Only handle if Navigation View is active and we're not in a text input
				if (evt.key === 'ArrowUp' && (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && !evt.altKey) {
					// Check if we're in a text input - if so, don't interfere
					const target = evt.target as HTMLElement;
					if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
						return; // Let the browser handle it
					}
					evt.preventDefault();
					evt.stopPropagation();
					evt.stopImmediatePropagation();
					await this.navigate(-1, viewType);
					return;
				}
				
				// Handle Ctrl/Cmd+Enter
				if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && !evt.altKey) {
					// Check if we're in a text input - if so, don't interfere
					const target = evt.target as HTMLElement;
					if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
						return; // Let the browser handle it
					}
					evt.preventDefault();
					evt.stopPropagation();
					evt.stopImmediatePropagation();
					await this.openInNewTab(viewType);
					return;
				}
			} catch (error) {
				console.error('Search Tab Plugin error:', error);
			}
		});

		// Watch for view updates
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.updateResults();
			})
		);

		// Also watch for when views are opened/changed
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.updateResults();
			})
		);

		console.log('✅ Search Tab Plugin loaded successfully');
		console.log('📝 Keyboard Shortcuts:');
		console.log('   - Open Search Tab: Cmd/Ctrl+P -> "Open Search Tab"');
		console.log('   - Navigate Next: Cmd/Ctrl+↓ (or use command "Navigate to Next Result")');
		console.log('   - Navigate Previous: Cmd/Ctrl+↑ (or use command "Navigate to Previous Result")');
		console.log('   - Open in New Tab (Keep Focus): Cmd/Ctrl+Enter (or use command "Open Current Result in New Tab (Keep Focus)")');
		console.log('   - Open in New Tab (Switch Focus): Use command "Open Current Result in New Tab (Switch Focus)")');
		console.log('   - Open in Split Pane: Use command "Open Current Result in Split Pane"');
		console.log('   - Switch to Search: Use command "Switch to Search Mode"');
		console.log('   - Switch to Backlinks: Use command "Switch to Backlinks Mode"');
		console.log('   - Note: All commands can be customized in Settings > Hotkeys');
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

	updateResults() {
		// Try to update based on current view type, or detect it
		if (this.currentViewType === 'search') {
			const searchView = this.getSearchView();
			if (searchView) {
				const { files, elements } = this.extractSearchResults(searchView);
				this.resultsCache = files;
				this.resultElements = elements;
				if (this.selectedIndex >= this.resultsCache.length) {
					this.selectedIndex = 0;
				}
				// Auto-select first result if Navigation View is open and active, and no file is displayed
				if (this.navigationView && this.navigationLeaf) {
					const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
					if (isActive && this.resultsCache.length > 0 && !this.currentFile) {
						this.navigationView.autoSelectFirst();
					}
				}
				return;
			}
		}
		
		if (this.currentViewType === 'backlinks') {
			const backlinksView = this.getBacklinksView();
			
			// If we have an original file but no backlinks view, try to get backlinks from metadata
			if (!backlinksView && this.originalBacklinksFile) {
				// Get backlinks from metadata cache
				const metadata = this.app.metadataCache.getFileCache(this.originalBacklinksFile);
				if (metadata) {
					const backlinkFiles: TFile[] = [];
					const backlinkElements: HTMLElement[] = [];
					
					// Get all files that link to this file
					const allFiles = this.app.vault.getMarkdownFiles();
					for (const file of allFiles) {
						const fileMetadata = this.app.metadataCache.getFileCache(file);
						if (fileMetadata) {
							// Check if this file links to our target file
							const linksToTarget = fileMetadata.links?.some(link => 
								link.link === this.originalBacklinksFile!.basename ||
								link.link === this.originalBacklinksFile!.name ||
								file.path.includes(this.originalBacklinksFile!.basename)
							);
							
							if (linksToTarget) {
								backlinkFiles.push(file);
								// Create a dummy element for highlighting
								const dummyEl = document.createElement('div');
								backlinkElements.push(dummyEl);
							}
						}
					}
					
					this.resultsCache = backlinkFiles;
					this.resultElements = backlinkElements;
					if (this.selectedIndex >= this.resultsCache.length) {
						this.selectedIndex = 0;
					}
					return;
				}
			}
			
			if (backlinksView) {
				// Check if we need to capture the original file
				if (!this.originalBacklinksFile) {
					// Try to get the current file from the active leaf
					const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (activeLeaf) {
						this.originalBacklinksFile = activeLeaf.file;
					}
				}
				
				const { files, elements } = this.extractBacklinks(backlinksView);
				this.resultsCache = files;
				this.resultElements = elements;
				if (this.selectedIndex >= this.resultsCache.length) {
					this.selectedIndex = 0;
				}
				return;
			}
		}
		
		// Auto-detect if no current view type
		const searchView = this.getSearchView();
		if (searchView) {
			const { files, elements } = this.extractSearchResults(searchView);
			this.resultsCache = files;
			this.resultElements = elements;
			this.currentViewType = 'search';
			this.originalBacklinksFile = null; // Reset for search
			// Update navigation view if it exists
			if (this.navigationView) {
				this.navigationView.setMode('search');
			}
			if (this.selectedIndex >= this.resultsCache.length) {
				this.selectedIndex = 0;
			}
			return;
		}

		const backlinksView = this.getBacklinksView();
		if (backlinksView) {
			// Capture the original file when first detecting backlinks
			const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeLeaf) {
				this.originalBacklinksFile = activeLeaf.file;
			}
			
			const { files, elements } = this.extractBacklinks(backlinksView);
			this.resultsCache = files;
			this.resultElements = elements;
			this.currentViewType = 'backlinks';
			if (this.selectedIndex >= this.resultsCache.length) {
				this.selectedIndex = 0;
			}
			// Auto-select first result if Navigation View is open and active, and no file is displayed
			if (this.navigationView && this.navigationLeaf) {
				const isActive = this.app.workspace.getActiveViewOfType(NavigationView) === this.navigationView;
				if (isActive && this.resultsCache.length > 0 && !this.currentFile) {
					this.navigationView.autoSelectFirst();
				}
			}
			return;
		}
		
		// No active view
		this.resultsCache = [];
		this.resultElements = [];
		this.currentViewType = null;
		this.originalBacklinksFile = null;
	}

	clearHighlight() {
		if (this.highlightedElement) {
			this.highlightedElement.style.backgroundColor = '';
			this.highlightedElement.style.outline = '';
			this.highlightedElement = null;
		}
	}

	highlightElement(element: HTMLElement) {
		// Clear previous highlight
		this.clearHighlight();
		
		// Add highlight
		element.style.backgroundColor = 'var(--background-modifier-hover, rgba(155, 155, 155, 0.1))';
		element.style.outline = '2px solid var(--interactive-accent, #7f6df2)';
		element.style.outlineOffset = '-2px';
		this.highlightedElement = element;
		
		// Scroll into view
		element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	extractSearchResults(searchView: View): { files: TFile[], elements: HTMLElement[] } {
		const results: TFile[] = [];
		const elements: HTMLElement[] = [];
		
		try {
		// Access the search results through the view's DOM
			// Try multiple possible selectors for different Obsidian versions
			let searchResultsEl = searchView.containerEl.querySelector('.search-results-children');
			if (!searchResultsEl) {
				searchResultsEl = searchView.containerEl.querySelector('.search-result-container');
			}
			if (!searchResultsEl) {
				searchResultsEl = searchView.containerEl.querySelector('.tree-item');
			}
			if (!searchResultsEl) {
				// Try to find any result container
				searchResultsEl = searchView.containerEl.querySelector('[class*="search"]');
			}
			
		if (!searchResultsEl) {
				return { files: results, elements };
			}

			// Find all result items - try multiple selectors
			let resultItems = searchResultsEl.querySelectorAll('.tree-item-self');
			if (resultItems.length === 0) {
				resultItems = searchResultsEl.querySelectorAll('.tree-item');
			}
			if (resultItems.length === 0) {
				resultItems = searchResultsEl.querySelectorAll('[class*="result"]');
			}

			resultItems.forEach((item: Element) => {
				try {
					const itemEl = item as HTMLElement;
					let titleEl = item.querySelector('.tree-item-inner');
					if (!titleEl) {
						titleEl = item.querySelector('.tree-item-inner-text');
					}
					if (!titleEl) {
						titleEl = item as Element; // Use the item itself if no inner element
					}
					
			if (titleEl) {
				const fileName = titleEl.textContent?.trim();
				if (fileName) {
							// Find the file in the vault - try multiple matching strategies
							let file = this.app.vault.getMarkdownFiles().find(f => 
								f.basename === fileName || f.path.endsWith(fileName) || f.name === fileName
							);
							
							// If not found, try without extension
							if (!file && fileName.includes('.')) {
								const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
								file = this.app.vault.getMarkdownFiles().find(f => 
									f.basename === nameWithoutExt
								);
							}
							
					if (file) {
						results.push(file);
								elements.push(itemEl);
							}
						}
					}
				} catch (error) {
					// Skip this item if there's an error
					console.debug('Error processing search result item:', error);
				}
			});
		} catch (error) {
			console.error('Error extracting search results:', error);
		}

		return { files: results, elements };
	}

	extractBacklinks(backlinksView: View): { files: TFile[], elements: HTMLElement[] } {
		const results: TFile[] = [];
		const elements: HTMLElement[] = [];
		
		try {
			// Access the backlinks through the view's DOM
			// Based on HTML structure: .backlink-pane > .search-result-container > .search-results-children > .tree-item > .tree-item-self.search-result-file-title
			const container = backlinksView.containerEl;
			
			// Find the backlink pane
			const backlinkPane = container.querySelector('.backlink-pane');
			if (!backlinkPane) {
				console.log('No .backlink-pane found, trying fallback selectors');
				// Fallback: try to find items directly
				const allItems = container.querySelectorAll('.search-result-file-title, .tree-item-self.search-result-file-title');
				allItems.forEach((item: Element) => {
					this.processBacklinkItem(item as HTMLElement, results, elements);
				});
				return { files: results, elements };
			}
			
			// Find all backlink file items - these are the actual files that link to the current note
			// They're in: .search-result-file-title or .tree-item-self.search-result-file-title
			const backlinkItems = backlinkPane.querySelectorAll('.search-result-file-title, .tree-item-self.search-result-file-title');
			
			console.log(`Found ${backlinkItems.length} backlink items in DOM`);

			backlinkItems.forEach((item: Element) => {
				this.processBacklinkItem(item as HTMLElement, results, elements);
			});
			
			// Also try to get from search-result-container if we didn't find enough
			if (results.length === 0) {
				const searchContainers = backlinkPane.querySelectorAll('.search-result-container');
				searchContainers.forEach((container: Element) => {
					const items = container.querySelectorAll('.search-result-file-title, .tree-item-self.search-result-file-title');
					items.forEach((item: Element) => {
						this.processBacklinkItem(item as HTMLElement, results, elements);
					});
				});
			}
			
		} catch (error) {
			console.error('Error extracting backlinks:', error);
		}

		console.log(`Extracted ${results.length} backlink files`);
		return { files: results, elements };
	}

	private processBacklinkItem(item: HTMLElement, results: TFile[], elements: HTMLElement[]): void {
		try {
			// Get the text from tree-item-inner
			const titleEl = item.querySelector('.tree-item-inner');
			if (!titleEl) return;
			
			const linkText = titleEl.textContent?.trim();
			if (!linkText) return;
			
			// Skip section headers like "Linked mentions" and "Unlinked mentions"
			if (linkText === 'Linked mentions' || linkText === 'Unlinked mentions') {
				return;
			}
			
			// Try to find the file - backlinks show the filename
			let file = this.app.vault.getMarkdownFiles().find(f => 
				f.basename === linkText || 
				f.name === linkText ||
				f.path.endsWith(linkText) ||
				f.path === linkText
			);
			
			// If not found, try without extension
			if (!file && linkText.includes('.')) {
				const nameWithoutExt = linkText.replace(/\.[^/.]+$/, '');
				file = this.app.vault.getMarkdownFiles().find(f => 
					f.basename === nameWithoutExt
				);
			}
			
			// Try to get file from data attributes
			if (!file) {
				const dataPath = item.getAttribute('data-path') || item.getAttribute('data-href');
				if (dataPath) {
					file = this.app.vault.getAbstractFileByPath(dataPath) as TFile;
				}
			}
			
			// Try getting from the item's click handler or data
			if (!file) {
				// Check if item has a data-file attribute
				const dataFile = item.getAttribute('data-file');
				if (dataFile) {
					file = this.app.vault.getAbstractFileByPath(dataFile) as TFile;
				}
			}
			
			if (file && file instanceof TFile) {
				// Avoid duplicates
				if (!results.find(f => f.path === file!.path)) {
					results.push(file);
					elements.push(item);
					console.log(`Added backlink: ${file.basename}`);
				}
			} else {
				console.log(`Could not find file for backlink: ${linkText}`);
			}
		} catch (error) {
			console.debug('Error processing backlink item:', error);
		}
	}

	async navigate(direction: number, viewType: ViewType) {
		// For backlinks, don't update if we've already captured the list
		// Only update if we don't have results yet
		if (this.resultsCache.length === 0 || (viewType === 'search')) {
			this.updateResults();
		}
		
		if (this.resultsCache.length === 0) {
			const viewName = viewType === 'backlinks' ? 'backlinks' : 'search results';
			console.log(`🔍 No ${viewName} found. Make sure you have results visible.`);
			return;
		}

		// Navigate
		this.selectedIndex += direction;
		
		// Wrap around
		if (this.selectedIndex < 0) {
			this.selectedIndex = this.resultsCache.length - 1;
		} else if (this.selectedIndex >= this.resultsCache.length) {
			this.selectedIndex = 0;
		}

		const currentFile = this.resultsCache[this.selectedIndex];
		if (!currentFile) {
			console.log('❌ No file found at index', this.selectedIndex);
			return;
		}
		
		// Store current file for Navigation View to display
		this.currentFile = currentFile;
		
		// Highlight the selected element
		if (this.selectedIndex < this.resultElements.length) {
			this.highlightElement(this.resultElements[this.selectedIndex]);
		}
		
		// Update Navigation View to show the file content
		if (this.navigationView) {
			this.navigationView.updateDisplay();
		}
		
		// For backlinks, open in preview but don't let it change the backlinks panel
		await this.updatePreview(currentFile, viewType);
		
		const viewName = viewType === 'backlinks' ? 'backlink' : 'result';
		console.log(`✅ Navigated to ${viewName} ${this.selectedIndex + 1}/${this.resultsCache.length}: ${currentFile.basename}`);
	}

	async updatePreview(file: TFile, viewType: ViewType) {
		// Get or create the preview leaf
		if (!this.previewLeaf || !this.previewLeaf.view) {
			// Create a new leaf for preview if it doesn't exist
			// Use 'split' to avoid creating a visible tab initially
			this.previewLeaf = this.app.workspace.getLeaf('split');
			// Hide the leaf by detaching it from the workspace visually
			// We'll keep it attached but not visible
		}

		// Check if the leaf is pinned
		const isPinned = (this.previewLeaf as any).pinned;
		
		if (isPinned) {
			// If pinned, create a new leaf for preview
			this.previewLeaf = this.app.workspace.getLeaf('split');
		}

		// Open the file in the preview leaf (don't activate it)
		// This should not create a visible tab if the leaf is not active
		await this.previewLeaf.openFile(file, { active: false });
		
		// For backlinks, make sure we restore focus to the original file's backlinks
		// This prevents the backlinks panel from switching to show the new file's backlinks
		if (viewType === 'backlinks' && this.originalBacklinksFile) {
			// Small delay to let the file open, then restore backlinks view
			setTimeout(() => {
				const backlinksView = this.getBacklinksView();
				if (backlinksView) {
					// Try to keep the backlinks view showing the original file
					// by ensuring the original file is still active in another leaf
					const leaves = this.app.workspace.getLeavesOfType('markdown');
					const originalLeaf = leaves.find(leaf => {
						const view = leaf.view as MarkdownView;
						return view && view.file && view.file.path === this.originalBacklinksFile!.path;
					});
					
					if (!originalLeaf && this.originalBacklinksFile) {
						// If the original file isn't open, open it in a background leaf
						// This keeps the backlinks panel showing the original file
						this.app.workspace.openLinkText(this.originalBacklinksFile.path, '', false);
					}
				}
			}, 100);
		}
	}

	async openInNewTab(viewType: ViewType) {
		this.updateResults();
		
		if (this.resultsCache.length === 0) {
			const viewName = viewType === 'backlinks' ? 'backlinks' : 'search results';
			console.log(`No ${viewName} available`);
			return;
		}

		const currentFile = this.resultsCache[this.selectedIndex];
		
		// Store reference to navigation leaf before opening new tab
		const navLeaf = this.navigationLeaf;
		
		// Open in a brand new tab (but don't activate it immediately)
		const newLeaf = this.app.workspace.getLeaf('tab');
		await newLeaf.openFile(currentFile, { active: false }); // Don't activate

		console.log(`Opened ${currentFile.basename} in new tab`);
		
		// Immediately return focus to the Navigation View without delay
		if (navLeaf) {
			// Use requestAnimationFrame to ensure the tab is created but we switch back immediately
			requestAnimationFrame(() => {
				this.app.workspace.revealLeaf(navLeaf);
				// Also ensure the navigation view is focused
				if (this.navigationView) {
					this.navigationView.contentEl.focus();
				}
			});
			setTimeout(() => {
				this.app.workspace.setActiveLeaf(this.navigationLeaf!, { focus: true });
			}, 50);
		}
	}

	async openInNewTabAndFocus(viewType: ViewType) {
		this.updateResults();
		
		if (this.resultsCache.length === 0) {
			const viewName = viewType === 'backlinks' ? 'backlinks' : 'search results';
			console.log(`No ${viewName} available`);
			return;
		}

		const currentFile = this.resultsCache[this.selectedIndex];
		
		// Open in a new tab and switch focus to it
		const newLeaf = this.app.workspace.getLeaf('tab');
		await newLeaf.openFile(currentFile, { active: true }); // Activate it

		console.log(`Opened ${currentFile.basename} in new tab and switched focus`);
	}

	async openToSide(viewType: ViewType) {
		this.updateResults();
		
		if (this.resultsCache.length === 0) {
			const viewName = viewType === 'backlinks' ? 'backlinks' : 'search results';
			console.log(`No ${viewName} available`);
			return;
		}

		const currentFile = this.resultsCache[this.selectedIndex];
		
		// Open in a split pane (new tab group to the side)
		const newLeaf = this.app.workspace.getLeaf('split', 'vertical');
		await newLeaf.openFile(currentFile, { active: true }); // Activate it so user can see it

		console.log(`Opened ${currentFile.basename} in split pane`);
	}

	async activateNavigationView() {
		if (!this.navigationLeaf) {
			this.navigationLeaf = this.app.workspace.getLeaf('tab');
			await this.navigationLeaf.setViewState({
				type: NAVIGATION_VIEW_TYPE,
				active: true,
			});
			this.navigationView = this.navigationLeaf.view as unknown as NavigationView;
		} else {
			this.app.workspace.revealLeaf(this.navigationLeaf);
		}
	}

	onunload() {
		console.log('Unloading Search Tab Plugin');
	}
}
