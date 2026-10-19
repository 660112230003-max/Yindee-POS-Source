-- Add Telegram notification settings to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS telegram_bot_token text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_chat_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_kitchen_chat_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_notify_enabled boolean DEFAULT true;

COMMENT ON COLUMN public.store_settings.telegram_bot_token IS 'Telegram Bot Token from @BotFather';
COMMENT ON COLUMN public.store_settings.telegram_chat_id IS 'Telegram Chat ID or Group ID to send customer waiter/bill notifications';
COMMENT ON COLUMN public.store_settings.telegram_kitchen_chat_id IS 'Telegram Chat ID or Group ID to send kitchen ready-to-serve notifications (optional, falls back to telegram_chat_id)';
COMMENT ON COLUMN public.store_settings.telegram_notify_enabled IS 'Toggle whether waiter/bill and kitchen calls should notify Telegram';

