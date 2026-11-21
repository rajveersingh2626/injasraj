import { describe, it, expect } from 'vitest';
import { WhiteboardPageManager } from '../../src/lib/whiteboard/page-manager';
import { WhiteboardPage } from '../../src/types/whiteboard';

describe('WhiteboardPageManager', () => {
  describe('Initialization & Defaults', () => {
    it('initializes with default page 1 when no parameters provided', () => {
      const manager = new WhiteboardPageManager();

      expect(manager.getPageCount()).toBe(1);
      const active = manager.getActivePage();
      expect(active).toBeDefined();
      expect(active.pageNumber).toBe(1);
      expect(active.title).toBe('Page 1');
      expect(active.canvasJson).toEqual({ version: '6.0', objects: [] });
      expect(manager.getActivePageId()).toBe(active.id);
      expect(manager.getActivePageIndex()).toBe(0);
    });

    it('initializes with default page 1 when empty array is passed', () => {
      const manager = new WhiteboardPageManager([]);

      expect(manager.getPageCount()).toBe(1);
      expect(manager.getActivePage().pageNumber).toBe(1);
      expect(manager.getAllPages()).toHaveLength(1);
    });

    it('initializes with provided pages and ensures 1-based sequential re-indexing', () => {
      const initialPages: WhiteboardPage[] = [
        {
          id: 'p-alpha',
          pageNumber: 99, // intentionally non-sequential
          title: 'Lesson Plan',
          canvasJson: { version: '6.0', objects: [{ type: 'rect' }] },
        },
        {
          id: 'p-beta',
          pageNumber: 104,
          title: 'Exercises',
          canvasJson: { version: '6.0', objects: [] },
        },
      ];

      const manager = new WhiteboardPageManager(initialPages);

      expect(manager.getPageCount()).toBe(2);
      const pages = manager.getAllPages();
      expect(pages[0].id).toBe('p-alpha');
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].title).toBe('Lesson Plan');
      expect(pages[0].canvasJson.objects).toHaveLength(1);

      expect(pages[1].id).toBe('p-beta');
      expect(pages[1].pageNumber).toBe(2);
      expect(pages[1].title).toBe('Exercises');

      // Default active page is the first page
      expect(manager.getActivePageId()).toBe('p-alpha');
    });

    it('sets initial activePageId if specified and valid', () => {
      const initialPages: WhiteboardPage[] = [
        { id: 'page-1', pageNumber: 1, title: 'One', canvasJson: null },
        { id: 'page-2', pageNumber: 2, title: 'Two', canvasJson: null },
      ];

      const manager = new WhiteboardPageManager(initialPages, 'page-2');
      expect(manager.getActivePageId()).toBe('page-2');
      expect(manager.getActivePage().title).toBe('Two');
      expect(manager.getActivePageIndex()).toBe(1);
    });

    it('falls back to the first page if initial activePageId is not found', () => {
      const initialPages: WhiteboardPage[] = [
        { id: 'p1', pageNumber: 1, title: 'First', canvasJson: null },
      ];

      const manager = new WhiteboardPageManager(initialPages, 'non-existent-id');
      expect(manager.getActivePageId()).toBe('p1');
    });
  });

  describe('Page Retrieval & Isolation', () => {
    it('returns all pages through getAllPages()', () => {
      const manager = new WhiteboardPageManager();
      manager.addPage('Page 2');
      manager.addPage('Page 3');

      const all = manager.getAllPages();
      expect(all).toHaveLength(3);
      expect(all.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    });

    it('retrieves pages by ID and index', () => {
      const manager = new WhiteboardPageManager();
      const page2 = manager.addPage('Geometry');

      expect(manager.getPageById(page2.id)?.title).toBe('Geometry');
      expect(manager.getPageById('unknown-id')).toBeUndefined();

      expect(manager.getPageByIndex(1)?.id).toBe(page2.id);
      expect(manager.getPageByIndex(99)).toBeUndefined();
      expect(manager.getPageByIndex(-1)).toBeUndefined();
    });

    it('protects internal state against external mutation on retrieved objects', () => {
      const manager = new WhiteboardPageManager();
      const active = manager.getActivePage();
      active.canvasJson.objects.push({ type: 'circle', radius: 20 });

      // Internal state must remain untouched
      expect(manager.getActivePage().canvasJson.objects).toHaveLength(0);
    });
  });

  describe('Active Page Switching & Navigation', () => {
    it('allows switching active page via setActivePage', () => {
      const manager = new WhiteboardPageManager();
      const page2 = manager.addPage('Algebra');

      const success = manager.setActivePage(page2.id);
      expect(success).toBe(true);
      expect(manager.getActivePageId()).toBe(page2.id);
      expect(manager.getActivePage().title).toBe('Algebra');

      const fail = manager.setActivePage('non-existent');
      expect(fail).toBe(false);
      expect(manager.getActivePageId()).toBe(page2.id);
    });

    it('navigates next and previous pages sequentially', () => {
      const manager = new WhiteboardPageManager();
      const p1Id = manager.getActivePageId();
      const p2 = manager.addPage('Page 2');
      const p3 = manager.addPage('Page 3');

      // Initially on p1
      expect(manager.getActivePageId()).toBe(p1Id);

      // Next -> p2
      const activeAfterNext1 = manager.nextPage();
      expect(activeAfterNext1.id).toBe(p2.id);
      expect(manager.getActivePageId()).toBe(p2.id);

      // Next -> p3
      const activeAfterNext2 = manager.nextPage();
      expect(activeAfterNext2.id).toBe(p3.id);
      expect(manager.getActivePageId()).toBe(p3.id);

      // Next at last page remains on p3
      const activeAtEnd = manager.nextPage();
      expect(activeAtEnd.id).toBe(p3.id);
      expect(manager.getActivePageId()).toBe(p3.id);

      // Previous -> p2
      const activeAfterPrev1 = manager.previousPage();
      expect(activeAfterPrev1.id).toBe(p2.id);
      expect(manager.getActivePageId()).toBe(p2.id);

      // Previous -> p1
      const activeAfterPrev2 = manager.previousPage();
      expect(activeAfterPrev2.id).toBe(p1Id);
      expect(manager.getActivePageId()).toBe(p1Id);

      // Previous at first page remains on p1
      const activeAtStart = manager.previousPage();
      expect(activeAtStart.id).toBe(p1Id);
      expect(manager.getActivePageId()).toBe(p1Id);
    });
  });

  describe('addPage', () => {
    it('adds a blank page with automatic title and sequential numbering', () => {
      const manager = new WhiteboardPageManager();
      const p2 = manager.addPage();

      expect(manager.getPageCount()).toBe(2);
      expect(p2.pageNumber).toBe(2);
      expect(p2.title).toBe('Page 2');
      expect(p2.canvasJson).toEqual({ version: '6.0', objects: [] });
    });

    it('adds a page with custom title and background PDF parameters', () => {
      const manager = new WhiteboardPageManager();
      const pdfUrl = 'https://supabase.co/storage/v1/worksheets/calculus.pdf';
      const page = manager.addPage('Integration Worksheet', pdfUrl, 4);

      expect(page.title).toBe('Integration Worksheet');
      expect(page.backgroundPdfUrl).toBe(pdfUrl);
      expect(page.backgroundPdfPage).toBe(4);
      expect(page.pageNumber).toBe(2);
    });

    it('trims whitespace and falls back to default title if empty string given', () => {
      const manager = new WhiteboardPageManager();
      const page = manager.addPage('   ');
      expect(page.title).toBe('Page 2');
    });
  });

  describe('duplicatePage', () => {
    it('duplicates an existing page including vector canvas content and background properties', () => {
      const manager = new WhiteboardPageManager();
      const active = manager.getActivePage();

      manager.updatePageCanvas(active.id, {
        version: '6.0',
        objects: [
          { type: 'rect', left: 100, top: 100, fill: '#ff0000' },
          { type: 'text', text: 'Quadratic Formula' },
        ],
      });
      manager.updatePageThumbnail(active.id, 'data:image/png;base64,thumb123');

      const dup = manager.duplicatePage(active.id);

      expect(manager.getPageCount()).toBe(2);
      expect(dup.id).not.toBe(active.id);
      expect(dup.pageNumber).toBe(2);
      expect(dup.title).toBe('Page 1 (Copy)');
      expect(dup.thumbnailUrl).toBe('data:image/png;base64,thumb123');
      expect(dup.canvasJson.objects).toHaveLength(2);
      expect(dup.canvasJson.objects[0].left).toBe(100);
      expect(dup.canvasJson.objects[1].text).toBe('Quadratic Formula');
    });

    it('inserts duplicate directly after the source page in multi-page notebooks', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      const p2 = manager.addPage('Original Page 2');
      const p3 = manager.addPage('Original Page 3');

      expect(manager.getPageCount()).toBe(3);

      // Duplicate p1 (at index 0) -> should be inserted at index 1
      const dupP1 = manager.duplicatePage(p1.id);
      expect(dupP1.pageNumber).toBe(2);

      const all = manager.getAllPages();
      expect(all.map((p) => p.id)).toEqual([p1.id, dupP1.id, p2.id, p3.id]);
      expect(all.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4]);

      // Duplicate p2 (now at index 2) -> should be inserted at index 3
      const dupP2 = manager.duplicatePage(p2.id);
      const allAfterSecondDup = manager.getAllPages();
      expect(allAfterSecondDup.map((p) => p.id)).toEqual([
        p1.id,
        dupP1.id,
        p2.id,
        dupP2.id,
        p3.id,
      ]);
      expect(allAfterSecondDup.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5]);
    });

    it('creates a deep copy such that mutations on duplicate canvas do not alter original', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      manager.updatePageCanvas(p1.id, {
        version: '6.0',
        objects: [{ type: 'circle', radius: 40 }],
      });

      const dup = manager.duplicatePage(p1.id);

      // Mutate duplicated page canvas
      manager.updatePageCanvas(dup.id, {
        version: '6.0',
        objects: [
          { type: 'circle', radius: 40 },
          { type: 'line', stroke: '#0000ff' },
        ],
      });

      expect(manager.getPageById(p1.id)?.canvasJson.objects).toHaveLength(1);
      expect(manager.getPageById(dup.id)?.canvasJson.objects).toHaveLength(2);
    });

    it('throws an error when attempting to duplicate non-existent page', () => {
      const manager = new WhiteboardPageManager();
      expect(() => manager.duplicatePage('fake-id')).toThrow(
        /does not exist/
      );
    });
  });

  describe('deletePage & Minimum Page Invariant', () => {
    it('prevents deleting the last remaining page (minimum 1 page guard)', () => {
      const manager = new WhiteboardPageManager();
      const activeId = manager.getActivePage().id;

      const deleted = manager.deletePage(activeId);
      expect(deleted).toBe(false);
      expect(manager.getPageCount()).toBe(1);
      expect(manager.getActivePageId()).toBe(activeId);
    });

    it('returns false when trying to delete non-existent page', () => {
      const manager = new WhiteboardPageManager();
      manager.addPage('Page 2');

      const deleted = manager.deletePage('does-not-exist');
      expect(deleted).toBe(false);
      expect(manager.getPageCount()).toBe(2);
    });

    it('deletes an inactive page without changing the active page focus', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      const p2 = manager.addPage('Page 2');
      const p3 = manager.addPage('Page 3');

      // Active is p1
      const deleted = manager.deletePage(p2.id);
      expect(deleted).toBe(true);
      expect(manager.getPageCount()).toBe(2);
      expect(manager.getActivePageId()).toBe(p1.id);

      const all = manager.getAllPages();
      expect(all.map((p) => p.id)).toEqual([p1.id, p3.id]);
      expect(all.map((p) => p.pageNumber)).toEqual([1, 2]);
    });

    it('shifts active focus to previous page when deleting active page at the end of the notebook', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      const p2 = manager.addPage('Page 2');
      const p3 = manager.addPage('Page 3');

      // Focus on last page (p3)
      manager.setActivePage(p3.id);
      expect(manager.getActivePageId()).toBe(p3.id);

      // Delete p3
      const deleted = manager.deletePage(p3.id);
      expect(deleted).toBe(true);
      expect(manager.getPageCount()).toBe(2);
      expect(manager.getActivePageId()).toBe(p2.id);
      expect(manager.getActivePage().pageNumber).toBe(2);
    });

    it('shifts active focus to next page when deleting active page at the beginning of the notebook', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      const p2 = manager.addPage('Page 2');
      const p3 = manager.addPage('Page 3');

      // Active is p1 (first page)
      const deleted = manager.deletePage(p1.id);
      expect(deleted).toBe(true);
      expect(manager.getPageCount()).toBe(2);
      expect(manager.getActivePageId()).toBe(p2.id);
      expect(manager.getActivePage().pageNumber).toBe(1); // p2 becomes page 1
    });

    it('shifts active focus to next page when deleting active page in the middle of the notebook', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      const p2 = manager.addPage('Page 2');
      const p3 = manager.addPage('Page 3');

      // Active is p2 (middle page)
      manager.setActivePage(p2.id);
      const deleted = manager.deletePage(p2.id);
      expect(deleted).toBe(true);
      expect(manager.getPageCount()).toBe(2);
      expect(manager.getActivePageId()).toBe(p3.id);
      expect(manager.getActivePage().pageNumber).toBe(2);
    });
  });

  describe('reorderPages', () => {
    it('reorders pages and re-indexes all page numbers sequentially', () => {
      const manager = new WhiteboardPageManager();
      const p1 = manager.getActivePage();
      const p2 = manager.addPage('Page 2');
      const p3 = manager.addPage('Page 3');

      // Move page 1 from index 0 to index 2 (end)
      const success = manager.reorderPages(0, 2);
      expect(success).toBe(true);

      const all = manager.getAllPages();
      expect(all.map((p) => p.id)).toEqual([p2.id, p3.id, p1.id]);
      expect(all.map((p) => p.pageNumber)).toEqual([1, 2, 3]);

      // Active page ID is preserved
      expect(manager.getActivePageId()).toBe(p1.id);
      // But its pageNumber is now 3
      expect(manager.getActivePage().pageNumber).toBe(3);
    });

    it('returns true without changing order when fromIndex === toIndex', () => {
      const manager = new WhiteboardPageManager();
      manager.addPage('Page 2');

      const success = manager.reorderPages(1, 1);
      expect(success).toBe(true);
      expect(manager.getPageCount()).toBe(2);
    });

    it('returns false for invalid or out-of-bounds indices', () => {
      const manager = new WhiteboardPageManager();
      manager.addPage('Page 2');

      expect(manager.reorderPages(-1, 0)).toBe(false);
      expect(manager.reorderPages(0, 5)).toBe(false);
      expect(manager.reorderPages(2, 0)).toBe(false);
      expect(manager.reorderPages(0.5, 1)).toBe(false);
    });
  });

  describe('updatePageCanvas & updatePageThumbnail', () => {
    it('updates page canvasJson and deep clones the payload', () => {
      const manager = new WhiteboardPageManager();
      const active = manager.getActivePage();
      const canvasPayload = {
        version: '6.0',
        objects: [{ type: 'path', path: [['M', 0, 0], ['L', 10, 10]] }],
      };

      const success = manager.updatePageCanvas(active.id, canvasPayload);
      expect(success).toBe(true);

      // Verify updated
      const updated = manager.getActivePage();
      expect(updated.canvasJson.objects).toHaveLength(1);

      // Verify external mutation does not affect store
      canvasPayload.objects.push({ type: 'rect' } as any);
      expect(manager.getActivePage().canvasJson.objects).toHaveLength(1);
    });

    it('updates current active page canvas via updateCurrentPageCanvas alias', () => {
      const manager = new WhiteboardPageManager();
      manager.updateCurrentPageCanvas({ objects: [{ type: 'rect', left: 50 }] });

      expect(manager.getActivePage().canvasJson.objects).toHaveLength(1);
    });

    it('returns false when updating canvas of non-existent page', () => {
      const manager = new WhiteboardPageManager();
      const success = manager.updatePageCanvas('non-existent', { objects: [] });
      expect(success).toBe(false);
    });

    it('updates and persists page thumbnail data', () => {
      const manager = new WhiteboardPageManager();
      const active = manager.getActivePage();
      const thumb = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';

      const success = manager.updatePageThumbnail(active.id, thumb);
      expect(success).toBe(true);
      expect(manager.getActivePage().thumbnailUrl).toBe(thumb);

      const fail = manager.updatePageThumbnail('unknown', thumb);
      expect(fail).toBe(false);
    });
  });

  describe('Comprehensive Multi-Step Workflow & Stress Resilience', () => {
    it('handles heavy addition, duplication, reordering, and deletion with continuous sequential indexing', () => {
      const manager = new WhiteboardPageManager();

      // Add 20 pages
      for (let i = 2; i <= 20; i++) {
        manager.addPage(`Chapter ${i}`);
      }
      expect(manager.getPageCount()).toBe(20);

      // Verify all pageNumbers are 1..20
      expect(manager.getAllPages().map((p) => p.pageNumber)).toEqual(
        Array.from({ length: 20 }, (_, idx) => idx + 1)
      );

      // Duplicate middle page (page 10)
      const page10 = manager.getPageByIndex(9)!;
      const dup = manager.duplicatePage(page10.id);
      expect(manager.getPageCount()).toBe(21);
      expect(dup.pageNumber).toBe(11);

      // Reorder last page to first
      manager.reorderPages(20, 0);
      expect(manager.getPageCount()).toBe(21);
      expect(manager.getAllPages().map((p) => p.pageNumber)).toEqual(
        Array.from({ length: 21 }, (_, idx) => idx + 1)
      );

      // Delete 15 pages one by one
      for (let k = 0; k < 15; k++) {
        const pages = manager.getAllPages();
        manager.deletePage(pages[0].id);
      }
      expect(manager.getPageCount()).toBe(6);
      expect(manager.getAllPages().map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(manager.getActivePage()).toBeDefined();
    });
  });
});
