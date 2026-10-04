import { CAR_BRANDS } from '../data/brandsAndTypes';

export interface CarModelRecord {
  id: string;
  brand_name: string;
  name: string;
}

class ModelService {
  public async getModelsByBrand(brandName: string): Promise<string[]> {
    const brand = CAR_BRANDS.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
    return brand ? [...brand.popular_models] : [];
  }
}

export const modelService = new ModelService();
