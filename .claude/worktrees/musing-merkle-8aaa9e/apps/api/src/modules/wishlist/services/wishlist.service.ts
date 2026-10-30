import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SavedCollegeRepository } from '../repositories/saved-college.repository';
import { WishlistListRepository } from '../repositories/wishlist-list.repository';
import { WishlistListItemRepository } from '../repositories/wishlist-list-item.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CollegeDocument } from '../../colleges/models/college.model';
import { WishlistEnrichmentService, CollegeEnrichment } from './wishlist-enrichment.service';
import { DEFAULT_LIST_DEFINITIONS, DEFAULT_LIST_KEYS, DefaultListKey, WishlistListDocument } from '../models/wishlist-list.model';
import { BookmarkStatus } from '../models/saved-college.model';
import { ListWishlistQueryDto } from '../dto/wishlist.dto';
import {
  DefaultListNotEditableException, DuplicateListNameException, ListNotFoundException,
  SavedCollegeNotFoundException, NoteNotFoundException,
} from '../wishlist.exceptions';
import { CollegeNotFoundException } from '../../colleges/colleges.exceptions';

export interface SavedCollegeView {
  collegeId: string;
  savedAt: Date;
  status: BookmarkStatus;
  notes: Array<{ id: string; text: string; createdAt: Date }>;
  listIds: string[];
  college: CollegeDocument;
  enrichment: CollegeEnrichment;
}

export interface ListSummary {
  id: string;
  key: string | null;
  name: string;
  icon: string;
  type: 'default' | 'custom';
  order: number;
  itemCount: number;
}

@Injectable()
export class WishlistService {
  constructor(
    private readonly savedCollegeRepo: SavedCollegeRepository,
    private readonly listRepo: WishlistListRepository,
    private readonly listItemRepo: WishlistListItemRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly enrichment: WishlistEnrichmentService,
  ) {}

  // ── Default lists ────────────────────────────────────────────────────────────

  async ensureDefaultLists(userId: string): Promise<WishlistListDocument[]> {
    const existing = await this.listRepo.listForUser(userId);
    const existingKeys = new Set(existing.filter(l => l.key).map(l => l.key));
    const missing = DEFAULT_LIST_KEYS.filter(key => !existingKeys.has(key));
    if (missing.length === 0) return existing;

    const created = await Promise.all(missing.map(key => {
      const def = DEFAULT_LIST_DEFINITIONS[key];
      return this.listRepo.create({ userId, key, name: def.name, icon: def.icon, type: 'default', order: def.order });
    }));
    return [...existing, ...created].sort((a, b) => a.order - b.order);
  }

  async getLists(userId: string): Promise<ListSummary[]> {
    const lists = await this.ensureDefaultLists(userId);
    const counts = await Promise.all(lists.map(l => this.listItemRepo.countForList(l.id)));
    return lists.map((l, i) => ({
      id: l.id, key: l.key, name: l.name, icon: l.icon, type: l.type, order: l.order, itemCount: counts[i],
    }));
  }

  async createList(userId: string, name: string, icon?: string): Promise<ListSummary> {
    const existing = await this.listRepo.listForUser(userId);
    if (existing.some(l => l.name.toLowerCase() === name.toLowerCase())) throw new DuplicateListNameException();
    const order = existing.length > 0 ? Math.max(...existing.map(l => l.order)) + 1 : 0;
    const created = await this.listRepo.create({ userId, key: null, name, icon: icon ?? '📁', type: 'custom', order });
    return this.toSummary(created, 0);
  }

  async renameList(userId: string, listId: string, name: string): Promise<ListSummary> {
    const list = await this.getOwnedList(userId, listId);
    if (list.type === 'default') throw new DefaultListNotEditableException();
    const updated = await this.listRepo.rename(userId, listId, name);
    if (!updated) throw new ListNotFoundException();
    return this.toSummary(updated, await this.listItemRepo.countForList(updated.id));
  }

  async deleteList(userId: string, listId: string): Promise<void> {
    const list = await this.getOwnedList(userId, listId);
    if (list.type === 'default') throw new DefaultListNotEditableException();
    await this.listItemRepo.removeAllForList(listId);
    await this.listRepo.delete(userId, listId);
  }

  async duplicateList(userId: string, listId: string): Promise<ListSummary> {
    const source = await this.getOwnedList(userId, listId);
    const items = await this.listItemRepo.findByList(listId);
    let name = `${source.name} (Copy)`;
    const existingNames = new Set((await this.listRepo.listForUser(userId)).map(l => l.name.toLowerCase()));
    let suffix = 2;
    while (existingNames.has(name.toLowerCase())) { name = `${source.name} (Copy ${suffix})`; suffix += 1; }

    const copy = await this.createList(userId, name, source.icon);
    await Promise.all(items.map(item => this.listItemRepo.add(userId, copy.id, item.collegeId)));
    return { ...copy, itemCount: items.length };
  }

  private toSummary(list: WishlistListDocument, itemCount: number): ListSummary {
    return { id: list.id, key: list.key, name: list.name, icon: list.icon, type: list.type, order: list.order, itemCount };
  }

  // ── Save / remove / status / notes ───────────────────────────────────────────

  async saveCollege(userId: string, collegeId: string, opts: { listId?: string; status?: string } = {}): Promise<void> {
    const college = await this.collegeRepo.findById(collegeId);
    if (!college) throw new CollegeNotFoundException();
    const resolvedId = college.id;

    await this.savedCollegeRepo.add(userId, resolvedId);
    if (opts.status) await this.savedCollegeRepo.setStatus(userId, resolvedId, opts.status as BookmarkStatus);

    if (opts.listId) {
      await this.getOwnedList(userId, opts.listId);
      await this.listItemRepo.add(userId, opts.listId, resolvedId);
    } else {
      const lists = await this.ensureDefaultLists(userId);
      const favorites = lists.find(l => l.key === 'favorites')!;
      await this.listItemRepo.add(userId, favorites.id, resolvedId);
    }
  }

  async removeCollege(userId: string, collegeId: string): Promise<void> {
    await this.listItemRepo.removeAllForCollege(userId, collegeId);
    await this.savedCollegeRepo.remove(userId, collegeId);
  }

  async getSavedStatus(userId: string, collegeId: string) {
    const saved = await this.savedCollegeRepo.find(userId, collegeId);
    if (!saved) return { saved: false, status: null, notes: [], listIds: [] };
    const listIds = await this.listItemRepo.findListIdsForCollege(userId, collegeId);
    return { saved: true, status: saved.status, notes: saved.notes, listIds };
  }

  async setStatus(userId: string, collegeId: string, status: string): Promise<void> {
    const updated = await this.savedCollegeRepo.setStatus(userId, collegeId, status as BookmarkStatus);
    if (!updated) throw new SavedCollegeNotFoundException();
  }

  async addNote(userId: string, collegeId: string, text: string) {
    const note = { id: randomUUID(), text, createdAt: new Date() };
    const updated = await this.savedCollegeRepo.addNote(userId, collegeId, note);
    if (!updated) throw new SavedCollegeNotFoundException();
    return note;
  }

  async removeNote(userId: string, collegeId: string, noteId: string): Promise<void> {
    const saved = await this.savedCollegeRepo.find(userId, collegeId);
    if (!saved) throw new SavedCollegeNotFoundException();
    if (!saved.notes.some(n => n.id === noteId)) throw new NoteNotFoundException();
    await this.savedCollegeRepo.removeNote(userId, collegeId, noteId);
  }

  // ── List membership ──────────────────────────────────────────────────────────

  async addToList(userId: string, listId: string, collegeId: string): Promise<void> {
    await this.getOwnedList(userId, listId);
    const saved = await this.savedCollegeRepo.find(userId, collegeId);
    if (!saved) throw new SavedCollegeNotFoundException();
    await this.listItemRepo.add(userId, listId, collegeId);
  }

  async removeFromList(userId: string, listId: string, collegeId: string): Promise<void> {
    await this.getOwnedList(userId, listId);
    await this.listItemRepo.remove(listId, collegeId);
  }

  async moveCollege(userId: string, collegeId: string, fromListId: string, toListId: string): Promise<void> {
    await this.getOwnedList(userId, fromListId);
    await this.getOwnedList(userId, toListId);
    await this.listItemRepo.remove(fromListId, collegeId);
    await this.listItemRepo.add(userId, toListId, collegeId);
  }

  // ── Full wishlist read (sort/filter) ─────────────────────────────────────────

  async getWishlist(userId: string, query: ListWishlistQueryDto): Promise<{ lists: ListSummary[]; colleges: SavedCollegeView[] }> {
    const lists = await this.getLists(userId);
    const savedDocs = await this.savedCollegeRepo.listForUser(userId);
    if (savedDocs.length === 0) return { lists, colleges: [] };

    const collegeIds = savedDocs.map(d => d.collegeId);
    const [colleges, allItems] = await Promise.all([
      this.collegeRepo.findByIds(collegeIds),
      this.listItemRepo.findByUser(userId),
    ]);
    const collegeById = new Map(colleges.map(c => [c.id, c]));
    const enrichmentByCollege = await this.enrichment.enrichMany(userId, colleges);

    const listIdsByCollege = new Map<string, string[]>();
    for (const item of allItems) {
      const arr = listIdsByCollege.get(item.collegeId) ?? [];
      arr.push(item.listId);
      listIdsByCollege.set(item.collegeId, arr);
    }

    let views: SavedCollegeView[] = savedDocs
      .filter(d => collegeById.has(d.collegeId))
      .map(d => ({
        collegeId: d.collegeId,
        savedAt: (d as unknown as { createdAt: Date }).createdAt,
        status: d.status,
        notes: d.notes,
        listIds: listIdsByCollege.get(d.collegeId) ?? [],
        college: collegeById.get(d.collegeId)!,
        enrichment: enrichmentByCollege.get(d.collegeId)!,
      }));

    views = this.applyFilters(views, query);
    views = this.applySort(views, query.sortBy, query.sortOrder);
    return { lists, colleges: views };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async getOwnedList(userId: string, listId: string): Promise<WishlistListDocument> {
    const list = await this.listRepo.findByIdForUser(userId, listId);
    if (!list) throw new ListNotFoundException();
    return list;
  }

  private applyFilters(views: SavedCollegeView[], q: ListWishlistQueryDto): SavedCollegeView[] {
    return views.filter(v => {
      const c = v.college;
      if (q.listId && !v.listIds.includes(q.listId)) return false;
      if (q.status && v.status !== q.status) return false;
      if (q.examCode && !c.courses.some(course => course.examsAccepted.includes(q.examCode!))) return false;
      if (q.collegeType && c.collegeType !== q.collegeType) return false;
      if (q.course) {
        const needle = q.course.toLowerCase();
        const haystack = c.courses.map(course => `${course.name} ${course.discipline}`).join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (q.city && c.city.toLowerCase() !== q.city.toLowerCase()) return false;
      if (q.district && (c.district ?? '').toLowerCase() !== q.district.toLowerCase()) return false;
      if (q.minFee != null && (c.feeBreakdown?.totalAnnualFee ?? 0) < q.minFee) return false;
      if (q.maxFee != null && (c.feeBreakdown?.totalAnnualFee ?? 0) > q.maxFee) return false;
      if (q.hostelAvailable && !(c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel)) return false;
      if (q.scholarshipEligible && !v.enrichment.scholarshipEligible) return false;
      if (q.minAdmissionProbability != null) {
        if (v.enrichment.admissionProbability == null || v.enrichment.admissionProbability < q.minAdmissionProbability) return false;
      }
      return true;
    });
  }

  private applySort(views: SavedCollegeView[], sortBy?: string, sortOrder?: string): SavedCollegeView[] {
    const dir = sortOrder === 'desc' ? -1 : 1;
    const withNullsLast = (a: number | null, b: number | null, ascending: boolean): number => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return ascending ? a - b : b - a;
    };
    const sorted = [...views];
    switch (sortBy) {
      case 'nirf':
        sorted.sort((a, b) => withNullsLast(a.college.accreditation?.nirfRank ?? null, b.college.accreditation?.nirfRank ?? null, true));
        break;
      case 'fees':
        sorted.sort((a, b) => dir * ((a.college.feeBreakdown?.totalAnnualFee ?? 0) - (b.college.feeBreakdown?.totalAnnualFee ?? 0)));
        break;
      case 'placement': {
        const latest = (c: CollegeDocument) => c.placementSummary?.[c.placementSummary.length - 1]?.placementPercentage ?? 0;
        sorted.sort((a, b) => dir * (latest(b.college) - latest(a.college)));
        break;
      }
      case 'roi':
        sorted.sort((a, b) => withNullsLast(a.enrichment.roiPercent, b.enrichment.roiPercent, false));
        break;
      case 'admissionProbability':
        sorted.sort((a, b) => withNullsLast(a.enrichment.admissionProbability, b.enrichment.admissionProbability, false));
        break;
      case 'aiScore':
        sorted.sort((a, b) => dir * (b.enrichment.aiRecommendationScore - a.enrichment.aiRecommendationScore));
        break;
      case 'name':
        sorted.sort((a, b) => dir * a.college.name.localeCompare(b.college.name));
        break;
      case 'recentlyAdded':
      default:
        sorted.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        break;
    }
    return sorted;
  }
}
