import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/filters/domain.exception';

export class SavedCollegeNotFoundException extends DomainException {
  constructor() { super('NOT_FOUND', 'This college is not in your wishlist.', HttpStatus.NOT_FOUND); }
}
export class ListNotFoundException extends DomainException {
  constructor() { super('NOT_FOUND', 'Wishlist not found.', HttpStatus.NOT_FOUND); }
}
export class DefaultListNotEditableException extends DomainException {
  constructor() { super('FORBIDDEN', 'Default lists cannot be renamed or deleted.', HttpStatus.FORBIDDEN); }
}
export class DuplicateListNameException extends DomainException {
  constructor() { super('CONFLICT', 'You already have a list with this name.', HttpStatus.CONFLICT); }
}
export class CompareLimitExceededException extends DomainException {
  constructor() { super('UNPROCESSABLE', 'You can compare up to 4 colleges at a time.', HttpStatus.UNPROCESSABLE_ENTITY); }
}
export class ShareTokenNotFoundOrExpiredException extends DomainException {
  constructor() { super('NOT_FOUND', 'This shared link is invalid or has expired.', HttpStatus.NOT_FOUND); }
}
export class NoteNotFoundException extends DomainException {
  constructor() { super('NOT_FOUND', 'Note not found.', HttpStatus.NOT_FOUND); }
}
