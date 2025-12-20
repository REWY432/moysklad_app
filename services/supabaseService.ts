
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { PackingListState } from '../types';

// ВСТАВЬТЕ СЮДА ВАШИ ДАННЫЕ ИЛИ ИСПОЛЬЗУЙТЕ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qlecwhveuodagkoxvmwk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_gx8I2CMF1Ndov0MfDsaYxA_JDsDTxNH';

class SupabaseService {
    private client: SupabaseClient | null = null;
    public isConfigured: boolean = false;

    constructor() {
        if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_KEY && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
            this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
            this.isConfigured = true;
        } else {
            console.warn("Supabase is not configured. Persistence will be disabled.");
        }
    }

    async savePackingList(state: PackingListState): Promise<void> {
        if (!this.client) return;

        try {
            const { error } = await this.client
                .from('packing_lists')
                .upsert({
                    order_id: state.order_id,
                    order_name: state.order_name,
                    places: state.places,
                    unpacked_items: state.unpacked_items,
                    order_comment: state.order_comment,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'order_id' });

            if (error) throw error;
        } catch (e) {
            console.error("Supabase Save Error:", e);
        }
    }

    async getPackingList(orderId: string): Promise<PackingListState | null> {
        if (!this.client) return null;

        try {
            const { data, error } = await this.client
                .from('packing_lists')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found" which is fine

            if (data) {
                return {
                    order_id: data.order_id,
                    order_name: data.order_name,
                    places: data.places,
                    unpacked_items: data.unpacked_items,
                    order_comment: data.order_comment,
                    updated_at: data.updated_at
                };
            }
            return null;
        } catch (e) {
            console.error("Supabase Load Error:", e);
            return null;
        }
    }

    async getPackingHistory(): Promise<PackingListState[]> {
        if (!this.client) return [];

        try {
            const { data, error } = await this.client
                .from('packing_lists')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Supabase History Error:", e);
            return [];
        }
    }

    async deletePackingList(orderId: string): Promise<boolean> {
        if (!this.client) return false;

        try {
            const { error } = await this.client
                .from('packing_lists')
                .delete({ count: 'exact' }) 
                .eq('order_id', orderId);

            if (error) {
                console.error("Supabase API Delete Error:", error);
                throw error;
            }
            return true;
        } catch (e) {
            console.error("Supabase Delete Exception:", e);
            return false;
        }
    }

    subscribeToPackingList(orderId: string, onUpdate: (newState: PackingListState) => void): RealtimeChannel | null {
        if (!this.client) return null;

        const channel = this.client
            .channel(`packing_list_${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'packing_lists',
                    filter: `order_id=eq.${orderId}`
                },
                (payload) => {
                    if (payload.new) {
                        const newData = payload.new as any;
                        onUpdate({
                            order_id: newData.order_id,
                            order_name: newData.order_name,
                            places: newData.places,
                            unpacked_items: newData.unpacked_items,
                            order_comment: newData.order_comment,
                            updated_at: newData.updated_at
                        });
                    }
                }
            )
            .subscribe();

        return channel;
    }
}

export const supabaseService = new SupabaseService();
