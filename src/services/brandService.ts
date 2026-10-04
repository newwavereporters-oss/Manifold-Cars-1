import { CarBrand } from '../types';
import { CAR_BRANDS } from '../data/brandsAndTypes';

class BrandService {
  private brands: CarBrand[] = [...CAR_BRANDS];

  public async getBrands(): Promise<CarBrand[]> {
    return [...this.brands];
  }

  public getBrandsSync(): CarBrand[] {
    return [...this.brands];
  }

  public async getBrandByName(name: string): Promise<CarBrand | null> {
    const found = this.brands.find((b) => b.name.toLowerCase() === name.toLowerCase());
    return found ? { ...found } : null;
  }
}

export const brandService = new BrandService();
