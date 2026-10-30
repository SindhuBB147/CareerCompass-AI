import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/filters/domain.exception';

export class CollegeNotFoundException extends DomainException {
  constructor() { super('NOT_FOUND', 'College not found.', HttpStatus.NOT_FOUND); }
}
export class CollegeAlreadyExistsException extends DomainException {
  constructor() { super('CONFLICT', 'A college with this name already exists in this state.', HttpStatus.CONFLICT); }
}
export class DuplicateCollegeCodeException extends DomainException {
  constructor(code: string) { super('CONFLICT', `College code "${code}" already exists.`, HttpStatus.CONFLICT); }
}
export class UnsupportedStateException extends DomainException {
  constructor(state: string) { super('UNPROCESSABLE', `"${state}" is outside the platform's current scope. Only Karnataka colleges are supported.`, HttpStatus.UNPROCESSABLE_ENTITY); }
}
export class SomeCollegesNotFoundException extends DomainException {
  constructor(ids: string[]) { super('NOT_FOUND', `One or more colleges not found: ${ids.join(', ')}`, HttpStatus.NOT_FOUND); }
}
export class CourseAlreadyExistsException extends DomainException {
  constructor() { super('CONFLICT', 'A course with this ID already exists at this college.', HttpStatus.CONFLICT); }
}
export class CourseNotFoundException extends DomainException {
  constructor() { super('NOT_FOUND', 'Course not found at this college.', HttpStatus.NOT_FOUND); }
}
export class UnknownExamCodeException extends DomainException {
  constructor(code: string) { super('UNPROCESSABLE', `"${code}" is not a supported exam. Supported: KCET, COMEDK, JEE, NEET.`, HttpStatus.UNPROCESSABLE_ENTITY); }
}
export class PlacementYearAlreadyExistsException extends DomainException {
  constructor(year: number) { super('CONFLICT', `Placement data for ${year} already exists.`, HttpStatus.CONFLICT); }
}
export class PlacementYearNotFoundException extends DomainException {
  constructor(year: number) { super('NOT_FOUND', `No placement data found for ${year}.`, HttpStatus.NOT_FOUND); }
}
export class InvalidPlacementYearException extends DomainException {
  constructor() { super('UNPROCESSABLE', 'Placement year must be in the past.', HttpStatus.UNPROCESSABLE_ENTITY); }
}
export class ImageNotFoundException extends DomainException {
  constructor() { super('NOT_FOUND', 'Image not found at this college.', HttpStatus.NOT_FOUND); }
}
export class DuplicateImageException extends DomainException {
  constructor() { super('CONFLICT', 'This image URL is already in the gallery.', HttpStatus.CONFLICT); }
}
