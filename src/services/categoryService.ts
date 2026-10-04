import { BodyTypeCategory } from '../types';
import { BODY_TYPES } from '../data/brandsAndTypes';

class CategoryService {
  private bodyTypes: BodyTypeCategory[] = [...BODY_TYPES];

  public async getBodyTypes(): Promise<BodyTypeCategory[]> {
    return [...this.bodyTypes];
  }

  public getBodyTypesSync(): BodyTypeCategory[] {
    return [...this.bodyTypes];
  }
}

export const categoryService = new CategoryService();
