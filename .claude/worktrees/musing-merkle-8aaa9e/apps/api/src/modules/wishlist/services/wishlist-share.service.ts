import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { WishlistShareRepository } from '../repositories/wishlist-share.repository';
import { WishlistListItemRepository } from '../repositories/wishlist-list-item.repository';
import { SavedCollegeRepository } from '../repositories/saved-college.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CreateShareDto } from '../dto/wishlist.dto';
import { ShareTokenNotFoundOrExpiredException, ListNotFoundException } from '../wishlist.exceptions';
import { WishlistListRepository } from '../repositories/wishlist-list.repository';

const SHARE_TTL_DAYS = 30;

@Injectable()
export class WishlistShareService {
  constructor(
    private readonly shareRepo: WishlistShareRepository,
    private readonly listRepo: WishlistListRepository,
    private readonly listItemRepo: WishlistListItemRepository,
    private readonly savedCollegeRepo: SavedCollegeRepository,
    private readonly collegeRepo: CollegeRepository,
  ) {}

  async createShare(userId: string, dto: CreateShareDto): Promise<{ token: string }> {
    let collegeIds = dto.collegeIds ?? [];
    if (dto.kind === 'wishlist') {
      const saved = await this.savedCollegeRepo.listForUser(userId);
      collegeIds = saved.map(s => s.collegeId);
    } else if (dto.kind === 'list') {
      if (!dto.listId) throw new ListNotFoundException();
      const list = await this.listRepo.findByIdForUser(userId, dto.listId);
      if (!list) throw new ListNotFoundException();
      const items = await this.listItemRepo.findByList(dto.listId);
      collegeIds = items.map(i => i.collegeId);
    }

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.shareRepo.create({ token, userId, kind: dto.kind, collegeIds, listId: dto.listId ?? null, expiresAt });
    return { token };
  }

  async resolve(token: string) {
    const share = await this.shareRepo.findByToken(token);
    if (!share) throw new ShareTokenNotFoundOrExpiredException();
    const colleges = await this.collegeRepo.findByIds(share.collegeIds);
    return { kind: share.kind, createdAt: (share as unknown as { createdAt: Date }).createdAt, colleges };
  }
}
