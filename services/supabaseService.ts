
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

        const payload = {
            order_id: state.order_id,
            order_name: state.order_name,
            places: state.places,
            unpacked_items: state.unpacked_items,
            order_comment: state.order_comment,
            updated_at: new Date().toISOString()
        };

        try {
            const { error } = await this.client
                .from('packing_lists')
                .upsert(payload, { onConflict: 'order_id' });

            if (error) throw error;
        } catch (e: any) {
            console.error("Supabase Save Error:", JSON.stringify(e, null, 2));

            // Fallback: Try saving without order_comment if it failed (likely due to missing column)
            if (state.order_comment !== undefined) {
                console.warn("Attempting fallback save without order_comment...");
                const { order_comment, ...fallbackPayload } = payload;
                try {
                    const { error: retryError } = await this.client
                        .from('packing_lists')
                        .upsert(fallbackPayload, { onConflict: 'order_id' });
                    
                    if (retryError) throw retryError;
                    console.log("Fallback save successful.");
                } catch (retryE) {
                    console.error("Fallback Save Error:", JSON.stringify(retryE, null, 2));
                }
            }
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
            console.error("Supabase Load Error:", JSON.stringify(e, null, 2));
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
            console.error("Supabase History Error:", JSON.stringify(e, null, 2));
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
                console.error("Supabase API Delete Error:", JSON.stringify(error, null, 2));
                throw error;
            }
            return true;
        } catch (e) {
            console.error("Supabase Delete Exception:", JSON.stringify(e, null, 2));
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
