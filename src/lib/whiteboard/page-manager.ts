import {
  WhiteboardPage,
  createDefaultWhiteboardPage,
} from '../../types/whiteboard';

/**
 * Generates an RFC4122-compliant or secure unique ID.
 * Falls back to high-entropy pseudo-random string in environments lacking Web Crypto.
 */
function generatePageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return (
    'page-' +
    Math.random().toString(36).substring(2, 11) +
    '-' +
    Date.now().toString(36)
  );
}

/**
 * Deep clones an object safely via JSON serialization.
 */
function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * WhiteboardPageManager manages the multi-page worksheet notebook state.
 *
 * Enforces:
 * 1. Minimum 1-page guard (notebook can never be empty).
 * 2. Continuous sequential 1-based page numbering across all operations.
 * 3. Deep cloning on page duplication and canvas state ingestion.
 * 4. Automatic active page focus migration on page deletion.
 */
export class WhiteboardPageManager {
  private pages: WhiteboardPage[] = [];
  private activePageId: string;

  constructor(initialPages?: WhiteboardPage[], activePageId?: string) {
    if (initialPages && Array.isArray(initialPages) && initialPages.length > 0) {
      this.pages = initialPages.map((page) => ({
        ...page,
        canvasJson: page.canvasJson
          ? deepClone(page.canvasJson)
          : { version: '6.0', objects: [] },
      }));
      this.reindexPages();

      if (activePageId && this.pages.some((p) => p.id === activePageId)) {
        this.activePageId = activePageId;
      } else {
        this.activePageId = this.pages[0].id;
      }
    } else {
      const defaultPage = createDefaultWhiteboardPage(
        generatePageId(),
        1,
        'Page 1'
      );
      this.pages = [defaultPage];
      this.activePageId = defaultPage.id;
    }
  }

  /**
   * Re-indexes all pages to enforce continuous sequential 1-based page numbers.
   */
  private reindexPages(): void {
    this.pages.forEach((page, index) => {
      page.pageNumber = index + 1;
    });
  }

  /**
   * Creates an isolated snapshot of a page with cloned canvasJson.
   */
  private clonePage(page: WhiteboardPage): WhiteboardPage {
    return {
      ...page,
      canvasJson: page.canvasJson
        ? deepClone(page.canvasJson)
        : { version: '6.0', objects: [] },
    };
  }

  /**
   * Returns total count of pages in the notebook.
   */
  public getPageCount(): number {
    return this.pages.length;
  }

  /**
   * Returns an array of all pages with isolated canvas state snapshots.
   */
  public getAllPages(): WhiteboardPage[] {
    return this.pages.map((p) => this.clonePage(p));
  }

  /**
   * Returns the currently active page.
   */
  public getActivePage(): WhiteboardPage {
    const page = this.pages.find((p) => p.id === this.activePageId);
    if (page) {
      return this.clonePage(page);
    }
    // Fallback guard to ensure never undefined
    return this.clonePage(this.pages[0]);
  }

  /**
   * Returns the ID of the currently active page.
   */
  public getActivePageId(): string {
    return this.activePageId;
  }

  /**
   * Returns the 0-based index of the currently active page.
   */
  public getActivePageIndex(): number {
    const index = this.pages.findIndex((p) => p.id === this.activePageId);
    return index !== -1 ? index : 0;
  }

  /**
   * Retrieves a page by its ID, or undefined if not found.
   */
  public getPageById(pageId: string): WhiteboardPage | undefined {
    const page = this.pages.find((p) => p.id === pageId);
    return page ? this.clonePage(page) : undefined;
  }

  public getPage(pageId: string): WhiteboardPage | undefined {
    return this.getPageById(pageId);
  }

  public renamePage(pageId: string, newTitle: string): boolean {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) return false;
    page.title = newTitle;
    return true;
  }

  /**
   * Retrieves a page by its 0-based index, or undefined if index out of bounds.
   */
  public getPageByIndex(index: number): WhiteboardPage | undefined {
    const page = this.pages[index];
    return page ? this.clonePage(page) : undefined;
  }

  /**
   * Switches the active page focus.
   * Returns true if page exists and focus switched, false otherwise.
   */
  public setActivePage(pageId: string): boolean {
    const exists = this.pages.some((p) => p.id === pageId);
    if (exists) {
      this.activePageId = pageId;
      return true;
    }
    return false;
  }

  /**
   * Advances active page to the next sequential page.
   * If already at the last page, remains on the last page.
   */
  public nextPage(): WhiteboardPage {
    const currentIndex = this.pages.findIndex((p) => p.id === this.activePageId);
    if (currentIndex >= 0 && currentIndex < this.pages.length - 1) {
      this.activePageId = this.pages[currentIndex + 1].id;
    }
    return this.getActivePage();
  }

  /**
   * Moves active page to the previous sequential page.
   * If already at the first page, remains on the first page.
   */
  public previousPage(): WhiteboardPage {
    const currentIndex = this.pages.findIndex((p) => p.id === this.activePageId);
    if (currentIndex > 0) {
      this.activePageId = this.pages[currentIndex - 1].id;
    }
    return this.getActivePage();
  }

  /**
   * Adds a new blank page to the end of the notebook.
   * Maintains continuous sequential page numbering.
   */
  public addPage(
    title?: string,
    backgroundPdfUrl?: string,
    backgroundPdfPage?: number
  ): WhiteboardPage {
    const newPageNumber = this.pages.length + 1;
    const newId = generatePageId();
    const resolvedTitle =
      title && title.trim().length > 0 ? title.trim() : `Page ${newPageNumber}`;

    const newPage = createDefaultWhiteboardPage(
      newId,
      newPageNumber,
      resolvedTitle
    );

    if (backgroundPdfUrl) {
      newPage.backgroundPdfUrl = backgroundPdfUrl;
    }
    if (backgroundPdfPage !== undefined) {
      newPage.backgroundPdfPage = backgroundPdfPage;
    }

    this.pages.push(newPage);
    this.reindexPages();
    return this.clonePage(newPage);
  }

  /**
   * Duplicates an existing page, creating a deep clone of its canvas objects
   * and background configuration, inserted directly after the source page.
   * All subsequent pages are re-indexed.
   *
   * @throws Error if source pageId does not exist.
   */
  public duplicatePage(pageId: string): WhiteboardPage {
    const sourceIndex = this.pages.findIndex((p) => p.id === pageId);
    if (sourceIndex === -1) {
      throw new Error(
        `Cannot duplicate page: Page with id '${pageId}' does not exist.`
      );
    }

    const source = this.pages[sourceIndex];
    const newId = generatePageId();
    const duplicatedPage: WhiteboardPage = {
      id: newId,
      pageNumber: sourceIndex + 2,
      title: source.title ? `${source.title} (Copy)` : `Page ${sourceIndex + 2}`,
      backgroundPdfUrl: source.backgroundPdfUrl,
      backgroundPdfPage: source.backgroundPdfPage,
      backgroundImageUrl: source.backgroundImageUrl,
      canvasJson: source.canvasJson
        ? deepClone(source.canvasJson)
        : { version: '6.0', objects: [] },
      thumbnailUrl: source.thumbnailUrl,
    };

    this.pages.splice(sourceIndex + 1, 0, duplicatedPage);
    this.reindexPages();
    return this.clonePage(duplicatedPage);
  }

  /**
   * Deletes a page from the notebook.
   * Guarded against deleting the last page (always keeps >= 1 page).
   * If the active page is deleted, automatically shifts active focus to the nearest available page.
   *
   * @returns true if deleted, false if page not found or only 1 page remains.
   */
  public deletePage(pageId: string): boolean {
    if (this.pages.length <= 1) {
      return false;
    }

    const targetIndex = this.pages.findIndex((p) => p.id === pageId);
    if (targetIndex === -1) {
      return false;
    }

    // Handle active page focus switch if deleting the currently active page
    if (this.activePageId === pageId) {
      if (targetIndex === this.pages.length - 1) {
        // Deleting the last page: focus switches to preceding page
        this.activePageId = this.pages[targetIndex - 1].id;
      } else {
        // Deleting first or middle page: focus switches to subsequent page
        this.activePageId = this.pages[targetIndex + 1].id;
      }
    }

    this.pages.splice(targetIndex, 1);
    this.reindexPages();
    return true;
  }

  /**
   * Moves a page from fromIndex to toIndex, re-indexing all page numbers sequentially.
   *
   * @returns true if reordered successfully, false if either index is out of bounds.
   */
  public reorderPages(fromIndex: number, toIndex: number): boolean {
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex < 0 ||
      fromIndex >= this.pages.length ||
      toIndex < 0 ||
      toIndex >= this.pages.length
    ) {
      return false;
    }

    if (fromIndex === toIndex) {
      return true;
    }

    const [movedPage] = this.pages.splice(fromIndex, 1);
    this.pages.splice(toIndex, 0, movedPage);
    this.reindexPages();
    return true;
  }

  /**
   * Updates the serialized Fabric.js canvas JSON graph for a specific page.
   *
   * @returns true if page was found and updated, false otherwise.
   */
  public updatePageCanvas(pageId: string, canvasJson: any): boolean {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) {
      return false;
    }

    page.canvasJson = canvasJson
      ? deepClone(canvasJson)
      : { version: '6.0', objects: [] };
    return true;
  }

  /**
   * Convenience alias to update the active page's canvas state.
   */
  public updateCurrentPageCanvas(canvasJson: any): boolean {
    return this.updatePageCanvas(this.activePageId, canvasJson);
  }

  /**
   * Updates the rendered thumbnail data URL for a specific page.
   *
   * @returns true if page was found and updated, false otherwise.
   */
  public updatePageThumbnail(pageId: string, thumbnailUrl: string): boolean {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) {
      return false;
    }

    page.thumbnailUrl = thumbnailUrl;
    return true;
  }

  /**
   * Updates the background PDF or image URL for a specific page.
   *
   * @returns true if page was found and updated, false otherwise.
   */
  public updatePageBackground(
    pageId: string,
    backgroundPdfUrl?: string,
    backgroundPdfPage?: number,
    backgroundImageUrl?: string
  ): boolean {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) {
      return false;
    }

    if (backgroundPdfUrl !== undefined) {
      page.backgroundPdfUrl = backgroundPdfUrl;
    }
    if (backgroundPdfPage !== undefined) {
      page.backgroundPdfPage = backgroundPdfPage;
    }
    if (backgroundImageUrl !== undefined) {
      page.backgroundImageUrl = backgroundImageUrl;
    }
    return true;
  }

  /**
   * Sets or clears the in-tab multi-page PDF document state on a page.
   */
  public setPagePdfDocument(
    pageId: string,
    pdfDocument?: import('../../types/whiteboard').PdfDocumentState
  ): boolean {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) {
      return false;
    }
    if (pdfDocument) {
      page.pdfDocument = deepClone(pdfDocument);
    } else {
      delete page.pdfDocument;
    }
    return true;
  }
}
