
import { MoySkladCredentials, MSProduct, MSOrder, MSOrderPosition } from '../types';

const BASE_URL = 'https://api.moysklad.ru/api/remap/1.2';
const DEFAULT_PROXY_URL = 'https://sweet-leaf-f3f1.supercell-help-2015.workers.dev';

export class MoySkladService {
  private credentials: MoySkladCredentials | null = null;
  private authHeader: string = '';
  public isDemoMode: boolean = false;
  private proxyUrl: string = DEFAULT_PROXY_URL;

  constructor() {
    // Check if there is a saved proxy url in localStorage for convenience
    // If not, use the default hardcoded Cloudflare Worker
    const savedProxy = localStorage.getItem('ms_proxy_url');
    if (savedProxy) {
      this.proxyUrl = savedProxy;
    }
  }

  setCredentials(creds: MoySkladCredentials) {
    this.credentials = creds;
    if (creds.token) {
      this.authHeader = `Bearer ${creds.token}`;
    } else if (creds.login && creds.password) {
      this.authHeader = `Basic ${btoa(`${creds.login}:${creds.password}`)}`;
    }
  }

  setProxyUrl(url: string) {
    // Remove trailing slashes
    this.proxyUrl = url.replace(/\/+$/, '');
    localStorage.setItem('ms_proxy_url', this.proxyUrl);
  }

  enableDemoMode() {
    this.isDemoMode = true;
  }

  getHeaders() {
    return {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    };
  }

  /**
   * Centralized request method handling Proxy logic
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const targetUrl = `${BASE_URL}${endpoint}`;
    
    let fetchUrl = targetUrl;
    
    // If a proxy URL is configured, route the request through it
    if (this.proxyUrl) {
      // Logic: proxyUrl?url=encodedTargetUrl
      const separator = this.proxyUrl.includes('?') ? '&' : '?';
      fetchUrl = `${this.proxyUrl}${separator}url=${encodeURIComponent(targetUrl)}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    return fetch(fetchUrl, config);
  }

  async checkConnection(): Promise<boolean> {
    if (this.isDemoMode) return true;
    if (!this.credentials) return false;
    try {
      const response = await this.makeRequest('/entity/organization', { method: 'GET' });
      return response.ok;
    } catch (error) {
      console.warn("Connection check failed.", error);
      return false;
    }
  }

  async getProducts(limit: number = 20): Promise<MSProduct[]> {
    if (this.isDemoMode) return this.getMockProducts(limit);

    try {
      const response = await this.makeRequest(`/entity/product?limit=${limit}`, { method: 'GET' });
      
      if (!response.ok) throw new Error(`Failed to fetch products: ${response.statusText}`);
      
      const data = await response.json();
      return data.rows || [];
    } catch (error) {
      console.error("Error fetching products", error);
      // If proxy fails, we might still want to show mock data or throw
      if (!this.proxyUrl) {
         console.info("Tip: Configure a CORS Proxy to fix connection issues.");
      }
      throw error; 
    }
  }

  async getOrders(limit: number = 10, search?: string): Promise<MSOrder[]> {
    if (this.isDemoMode) return this.getMockOrders(limit, search);

    try {
      // expand=agent,organization allows us to see names immediately
      let queryString = `limit=${limit}&order=moment,desc&expand=agent,organization`;
      
      if (search) {
        queryString += `&search=${encodeURIComponent(search)}`;
      }

      const response = await this.makeRequest(`/entity/customerorder?${queryString}`, { method: 'GET' });
      
      if (!response.ok) throw new Error(`Failed to fetch orders: ${response.statusText}`);
      
      const data = await response.json();
      return data.rows || [];
    } catch (error) {
      console.error("Error fetching orders", error);
      throw error;
    }
  }

  async getOrder(id: string): Promise<MSOrder | null> {
    if (this.isDemoMode) {
        const orders = await this.getMockOrders(100);
        return orders.find(o => o.id === id) || null;
    }

    try {
      const response = await this.makeRequest(`/entity/customerorder/${id}?expand=agent,organization`, { method: 'GET' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Error fetching single order", error);
      return null;
    }
  }

  async getOrderPositions(orderId: string): Promise<MSOrderPosition[]> {
    if (this.isDemoMode) return this.getMockOrderPositions(orderId);

    try {
      const response = await this.makeRequest(`/entity/customerorder/${orderId}/positions?expand=assortment`, { method: 'GET' });

      if (!response.ok) throw new Error(`Failed to fetch positions: ${response.statusText}`);

      const data = await response.json();
      return (data.rows || []).map((row: any) => ({
        id: row.id,
        quantity: row.quantity,
        price: row.price,
        assortment: {
            name: row.assortment.name,
            code: row.assortment.code,
            article: row.assortment.article,
            meta: row.assortment.meta,
            uom: row.assortment.uom || { name: 'шт' }
        }
      }));
    } catch (error) {
      console.error("Error fetching positions", error);
      throw error;
    }
  }

  // --- Mock Data Generators (kept for Demo Mode) ---

  private getMockProducts(limit: number): Promise<MSProduct[]> {
    const products: MSProduct[] = [
      { id: 'p1', name: 'Бутылка для воды ЭКО', code: 'WB-001', article: 'ECO-WB', quantity: 150, salePrices: [{ value: 150000, currency: { name: 'RUB' } }] },
      { id: 'p2', name: 'Беспроводные наушники', code: 'WH-X1000', article: 'AUDIO-02', quantity: 45, salePrices: [{ value: 2500000, currency: { name: 'RUB' } }] },
      { id: 'p3', name: 'Офисное кресло Эрго', code: 'CH-ERG', article: 'FURN-99', quantity: 12, salePrices: [{ value: 1800000, currency: { name: 'RUB' } }] },
      { id: 'p4', name: 'Механическая клавиатура RGB', code: 'KB-MECH', article: 'TECH-KB', quantity: 80, salePrices: [{ value: 850000, currency: { name: 'RUB' } }] },
      { id: 'p5', name: 'Док-станция USB-C', code: 'DOCK-C', article: 'ACC-05', quantity: 200, salePrices: [{ value: 450000, currency: { name: 'RUB' } }] },
    ];
    return Promise.resolve(products.slice(0, limit));
  }

  private getMockOrders(limit: number, search?: string): Promise<MSOrder[]> {
    const now = new Date();
    let orders: MSOrder[] = [
      { 
        id: 'o1', name: '00001', moment: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), sum: 4500000, 
        agent: { meta: { href: '', metadataHref: '', type: 'counterparty', mediaType: 'application/json' }, name: 'ООО "Вектор"' },
        organization: { meta: { href: '', metadataHref: '', type: 'organization', mediaType: 'application/json' }, name: 'Моя Компания' },
        state: { name: 'Новый', color: '#ef4444' },
        description: 'Срочная доставка до 18:00'
      },
      { 
        id: 'o2', name: '00002', moment: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), sum: 1850000, 
        agent: { meta: { href: '', metadataHref: '', type: 'counterparty', mediaType: 'application/json' }, name: 'ИП Иванов А.А.' },
        organization: { meta: { href: '', metadataHref: '', type: 'organization', mediaType: 'application/json' }, name: 'Моя Компания' },
        state: { name: 'Отгружен', color: '#22c55e' }
      },
      { 
        id: 'o3', name: '00003', moment: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(), sum: 1250000, 
        agent: { meta: { href: '', metadataHref: '', type: 'counterparty', mediaType: 'application/json' }, name: 'ЗАО "ТехноСнаб"' },
        organization: { meta: { href: '', metadataHref: '', type: 'organization', mediaType: 'application/json' }, name: 'Филиал Север' },
        state: { name: 'Подтвержден', color: '#f59e0b' }
      },
    ];

    if (search) {
      orders = orders.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
    }

    return Promise.resolve(orders.slice(0, limit));
  }

  private getMockOrderPositions(orderId: string): Promise<MSOrderPosition[]> {
    return Promise.resolve([
        {
            id: 'pos1',
            quantity: 2,
            price: 150000,
            assortment: {
                name: 'Бутылка для воды ЭКО',
                code: 'WB-001',
                article: 'ECO-WB',
                meta: { href: '', type: 'product' },
                uom: { name: 'шт' }
            }
        },
        {
            id: 'pos2',
            quantity: 1,
            price: 450000,
            assortment: {
                name: 'Док-станция USB-C',
                code: 'DOCK-C',
                article: 'ACC-05',
                meta: { href: '', type: 'product' },
                uom: { name: 'шт' }
            }
        }
    ]);
  }
}

export const moysklad = new MoySkladService();
